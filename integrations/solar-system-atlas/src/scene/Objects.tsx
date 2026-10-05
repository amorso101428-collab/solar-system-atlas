import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { OBJECTS } from '../data/objects'
import { FILTER_BY_ID } from '../data/filters'
import type { GlyphKind, ObjectCategory } from '../data/types'
import { createObjectNodeMaterial } from './materials'
import { getWorld, objectWeight } from '../utils/world'
import { worldNow } from '../utils/clock'
import { useAtlasStore } from '../state/atlasStore'
import { yearOf } from '../utils/formatters'
import { damp, focusBackgroundDim, satelliteVisibility } from '../utils/reveal'

/** 类别色：只在节点上出现，整体画面仍然保持 90% 黑灰米白 */
export const CATEGORY_COLOR: Record<ObjectCategory, string> = {
  EARTH: '#a8d2de',
  MOON: '#d3c894',
  MARS: '#d1906f',
  OUTER: '#dbb98c',
  SMALL_BODY: '#b6a888',
  SOLAR: '#f0bd76',
  DEEP_SPACE: '#f2c894',
}

const GLYPH_INDEX: Record<GlyphKind, number> = {
  dot: 0,
  station: 1,
  telescope: 2,
  probe: 3,
  mirror: 4,
  solar: 5,
  rover: 6,
  capsule: 7,
}

/**
 * 人类造物节点（方案书 §6）。
 *
 * 关键修正：正交相机下 `gl_PointSize` 不能再除以视深度——那样所有标记都会被
 * 钳到最小尺寸，只剩一个 2px 的点。现在标记是屏幕空间恒定大小的"发光剪影"，
 * 并按种类给出不同的极简形状（桁架 / 镜筒 / 天线 / 六边镜 / 巡视器 / 返回舱），
 * 因此看得见、认得出、也点得到（命中区另算，见 OverlayBridge）。
 */
export function Objects() {
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const weights = useRef<Float32Array>(new Float32Array(OBJECTS.length).fill(1))
  const reveals = useRef<Float32Array>(new Float32Array(OBJECTS.length).fill(1))

  const geometry = useMemo(() => {
    const count = OBJECTS.length
    const positions = new Float32Array(count * 3)
    const sizes = new Float32Array(count)
    const colors = new Float32Array(count * 3)
    const states = new Float32Array(count)
    const weightAttr = new Float32Array(count).fill(1)
    const revealAttr = new Float32Array(count).fill(1)
    const glyphs = new Float32Array(count)
    const color = new THREE.Color()

    OBJECTS.forEach((object, index) => {
      color.set(CATEGORY_COLOR[object.category])
      colors[index * 3 + 0] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
      const importance = object.importance ?? 2
      // 屏幕空间像素尺寸：主视觉对象明显更大，但最小的也还看得见
      sizes[index] = importance === 1 ? 15 : importance === 2 ? 11 : 8
      glyphs[index] = GLYPH_INDEX[object.glyph ?? 'dot']
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
    geo.setAttribute('aState', new THREE.BufferAttribute(states, 1))
    geo.setAttribute('aWeight', new THREE.BufferAttribute(weightAttr, 1))
    geo.setAttribute('aReveal', new THREE.BufferAttribute(revealAttr, 1))
    geo.setAttribute('aGlyph', new THREE.BufferAttribute(glyphs, 1))
    return geo
  }, [])

  const material = useMemo(() => createObjectNodeMaterial(), [])

  useFrame((state) => {
    const t = worldNow()
    const world = getWorld(t)
    const { hoveredId, selectedObjectId, activeFilter, timelineYear, viewLayer, hideArtificial, hideAllOrbits } =
      useAtlasStore.getState()
    const layerScale = viewLayer === 'ORBITAL' ? 0.55 : 1
    // 隐藏人造卫星及其轨道 / 隐藏所有轨道：节点整体退场（v5 §21）
    const artificialScale = hideArtificial || hideAllOrbits ? 0 : 1
    const filter = FILTER_BY_ID.get(activeFilter)

    const positions = geometry.attributes.position as THREE.BufferAttribute
    const states = geometry.attributes.aState as THREE.BufferAttribute
    const weightsAttr = geometry.attributes.aWeight as THREE.BufferAttribute
    const revealAttr = geometry.attributes.aReveal as THREE.BufferAttribute
    const posArray = positions.array as Float32Array
    const stateArray = states.array as Float32Array
    const weightArray = weightsAttr.array as Float32Array
    const revealArray = revealAttr.array as Float32Array

    // 正交相机：可见世界高度就是"离得多近"
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    OBJECTS.forEach((object, index) => {
      const anchor = world.objects.get(object.id)
      if (anchor) {
        posArray[index * 3 + 0] = anchor.position.x
        posArray[index * 3 + 1] = anchor.position.y
        posArray[index * 3 + 2] = anchor.position.z
      }
      /**
       * v8.2：人造卫星的**圆点与它的轨道线必须同时出现 / 同时消失**。
       *
       * 旧版这里用自己的 `near` 公式，轨道线用另一套阈值，于是"点先出来、
       * 轨道还没出来"。现在两边都乘同一个 `satelliteVisibility(systemDiskScreen)`
       * —— 也就是以**这个天体系统的盘在屏幕上有多大**为准，节点、轨道、标签完全同步。
       */
      const diskRadius = anchor?.diskId
        ? (world.systems.get(anchor.diskId)?.radius ?? 6)
        : 10
      const systemDiskScreen =
        (diskRadius / Math.max(viewHeight, 0.001)) * state.size.height * 0.5
      const systemVis = satelliteVisibility(systemDiskScreen)
      const target = objectWeight(yearOf(object.launched), filter ? filter.match(object) : true, timelineYear)
      const weighted = target * artificialScale * systemVis
      weights.current[index] += (weighted - weights.current[index]) * 0.085
      if (Math.abs(weighted - weights.current[index]) < 0.002) weights.current[index] = weighted
      weightArray[index] = weights.current[index]
      stateArray[index] = object.id === selectedObjectId ? 2 : object.id === hoveredId ? 1 : 0

      // LOD：总览里只留"主视觉对象"，其余随系统可见度一起淡入
      const importance = object.importance ?? 2
      const goal =
        (importance === 1 ? 0.9 : importance === 2 ? systemVis * 0.85 : systemVis * 0.6) *
        layerScale
      reveals.current[index] += (goal - reveals.current[index]) * 0.06
      revealArray[index] = reveals.current[index]
    })

    positions.needsUpdate = true
    states.needsUpdate = true
    weightsAttr.needsUpdate = true
    revealAttr.needsUpdate = true
    material.uniforms.uTime.value = t
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
    /**
     * v8 §26：聚焦行星 / 月球时，航天器退到 0.06。
     * 它们的任务说明已经搬到右侧档案，屏幕上不该再和行星表面的全息标注抢位置。
     */
    const focusKind = useAtlasStore.getState().focusKind
    material.uniforms.uDim.value = damp(
      material.uniforms.uDim.value as number,
      focusBackgroundDim(focusKind).objects,
      5,
      1 / 60
    )
  })

  return <points name="objects" geometry={geometry} material={material} frustumCulled={false} />
}
