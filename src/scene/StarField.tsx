import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { createStarMaterial } from './materials'
import { useAtlasStore } from '../state/atlasStore'
import { focusBackgroundDim, sceneReveal } from '../utils/reveal'

/**
 * 宇宙背景（方案书 §21）。
 *
 * **稳定优先**：这里只有固定在世界坐标里的星点，没有任何"跟着镜头转的星云穹顶"。
 * 上一版那层银河贴图会让拖拽时整片背景忽亮忽暗——那正是用户看到的闪烁。
 * 星点不动、不随镜头缩放、不随角度变亮，背景就永远是一致的深空。
 */

interface LayerSpec {
  count: number
  radius: number
  inner: number
  minScale: number
  maxScale: number
  brightness: number
  seed: number
}

const LAYERS: LayerSpec[] = [
  // 背景层：一万多颗极暗的星，只为了给黑色一点深度
  { count: 11000, radius: 1250, inner: 980, minScale: 0.5, maxScale: 1.5, brightness: 0.34, seed: 20260920 },
  // 中层：星尘
  { count: 2200, radius: 820, inner: 620, minScale: 0.7, maxScale: 2.4, brightness: 0.6, seed: 778899 },
  // 近层：少量亮星，缓慢漂移
  { count: 220, radius: 520, inner: 380, minScale: 1.4, maxScale: 3.4, brightness: 1, seed: 314159 },
]

function StarLayer({ spec }: { spec: LayerSpec }) {
  const material = useMemo(() => createStarMaterial(), [])
  const groupRef = useRef<THREE.Points>(null)
  const gl = useThree((state) => state.gl)

  const geometry = useMemo(() => {
    const positions = new Float32Array(spec.count * 3)
    const scales = new Float32Array(spec.count)
    const tints = new Float32Array(spec.count * 3)
    const color = new THREE.Color()
    let seed = spec.seed
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let i = 0; i < spec.count; i++) {
      const r = spec.inner + rand() * (spec.radius - spec.inner)
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(2 * rand() - 1)
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
      scales[i] = spec.minScale + Math.pow(rand(), 3.4) * (spec.maxScale - spec.minScale)
      // 冷白到暖白的极轻色偏，外加一点点琥珀色的大星
      const warm = rand()
      color.setRGB(0.74 + warm * 0.26, 0.78 + warm * 0.18, 0.86 + (1 - warm) * 0.14)
      tints[i * 3 + 0] = color.r
      tints[i * 3 + 1] = color.g
      tints[i * 3 + 2] = color.b
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    geo.setAttribute('aTint', new THREE.BufferAttribute(tints, 3))
    return geo
  }, [spec])

  useEffect(() => {
    material.uniforms.uPixelRatio.value = Math.min(gl.getPixelRatio(), 2)
    material.uniforms.uBrightness.value = spec.brightness
  }, [gl, material, spec.brightness])

  useFrame((state) => {
    void state
    // VIEW / ORBITAL：图谱模式里星空要退到几乎看不见
    const orbital = useAtlasStore.getState().viewLayer === 'ORBITAL'
    material.uniforms.uBrightness.value =
      spec.brightness * (orbital ? 0.3 : 1) * focusBackgroundDim(useAtlasStore.getState().focusKind).stars
    /**
     * v8 §8：开场俯视全景时背景略微失焦（星点变大变淡），
     * 进入侧视 Atlas 的过程中连续收回到清晰 —— 前景的行星与轨道始终锐利。
     */
    material.uniforms.uDefocus.value = 1 + 0.85 * (1 - sceneReveal.value)
  })

  return <points ref={groupRef} geometry={geometry} material={material} frustumCulled={false} />
}

export function StarField() {
  return (
    <group name="starfield">
      {LAYERS.map((spec) => (
        <StarLayer key={spec.seed} spec={spec} />
      ))}
    </group>
  )
}
