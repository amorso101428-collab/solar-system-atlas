import { useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtlasStore } from '../state/atlasStore'
import {
  BODY_LAYERS_FULL,
  HOLO_CAPTION,
  SURFACE_FEATURES,
  type SurfaceFeature,
} from '../data/surfaceFeatures'
import { PLANETS } from '../data/planets'
import { getWorld } from '../utils/world'
import { smoothYear, worldNow } from '../utils/clock'
import { SUN_RADIUS } from '../utils/layout'
import { axisQuaternion, daysSinceJ2000, spinAngle, tidalLockSpin } from '../astronomy/orientation'
import { isTouchLayout, getLayoutMode } from '../responsive/device'

/** 触屏设备上要给顶栏 + 返回键留出的上边界（桌面为 0） */
function usesTopInset(): boolean {
  return isTouchLayout(getLayoutMode())
}

/** 手机屏上全息标注只出 Top 3（§28 的 progressive disclosure） */
function isPhoneLayout(): boolean {
  return getLayoutMode() === 'mobile-portrait' || getLayoutMode() === 'mobile-landscape'
}

/**
 * 行星表面全息分析层（v8 §23–§37）。
 *
 * 标注**贴在球面上**：每条地貌带真实经纬度，每帧换算
 *   局部方向 → 本体自转 → 赤道面姿态 → 世界坐标 → 屏幕坐标
 * 所以行星自转时标注跟着转，转到背面会连续淡出。
 *
 * 视觉规则（§28）：暖白 / 淡青 / 柔琥珀，线宽 0.5–1px，透明度 0.10–0.42。
 * 这是科学标注，不是霓虹赛博描边。
 */
const CONTAINER_ID = 'holo-layer'
const DEG = Math.PI / 180

interface FeatureNode {
  root: HTMLDivElement
  leader: HTMLDivElement
  label: HTMLDivElement
}

const RING_SEGMENTS = 96
const RING_COLOR = '#bcd4e0'

/** 球面范围圈共用一份材质：细、淡、不写深度（v8.1） */
const holoRingMaterial = new THREE.LineBasicMaterial({
  color: RING_COLOR,
  transparent: true,
  opacity: 0.34,
  depthWrite: false,
})

/**
 * 在球体**局部坐标系**里把一个范围圈建出来（v8.1）。
 *
 * 关键点：几何是固定的局部圆环，每帧只更新它的 position / quaternion。
 * 所以无论镜头怎么转、行星怎么自转，这圈线始终贴在球面上同一个经纬度处，
 * 而不是在屏幕空间里悬着——这正是用户要的"贴在球形贴图上"。
 */
function buildSurfaceRing(lat: number, lon: number, sizeDeg: number, radius: number): THREE.BufferGeometry {
  const latRad = lat * DEG
  const lonRad = lon * DEG
  const center = new THREE.Vector3(
    Math.cos(latRad) * Math.cos(lonRad),
    Math.sin(latRad),
    Math.cos(latRad) * Math.sin(lonRad)
  ).normalize()
  const helper = Math.abs(center.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const t1 = new THREE.Vector3().crossVectors(center, helper).normalize()
  const t2 = new THREE.Vector3().crossVectors(center, t1).normalize()
  const theta = Math.max(0.5 * DEG, (sizeDeg / 2) * DEG)
  const points: THREE.Vector3[] = []
  const r = radius * 1.008
  for (let i = 0; i < RING_SEGMENTS; i++) {
    const phi = (i / RING_SEGMENTS) * Math.PI * 2
    const dir = center
      .clone()
      .multiplyScalar(Math.cos(theta))
      .addScaledVector(t1, Math.sin(theta) * Math.cos(phi))
      .addScaledVector(t2, Math.sin(theta) * Math.sin(phi))
    points.push(dir.multiplyScalar(r))
  }
  return new THREE.BufferGeometry().setFromPoints(points)
}

const MOON_BY_ID = new Map(
  PLANETS.flatMap((planet) => planet.moons.map((moon) => [moon.id, { moon, planetId: planet.id }]))
)

export function HoloBridge() {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  const nodes = useRef(new Map<string, FeatureNode>())
  const rulerRef = useRef<HTMLDivElement | null>(null)
  const captionRef = useRef<HTMLDivElement | null>(null)
  /** 球面上的 3D 范围圈：key = 天体:特征 */
  const ringGroupRef = useRef<THREE.Group>(null)
  const ringsRef = useRef(new Map<string, THREE.LineLoop>())

  useFrame(() => {
    const container = document.getElementById(CONTAINER_ID)
    if (!container) return
    const state = useAtlasStore.getState()
    const bodyId =
      state.focusKind === 'PLANET' || state.focusKind === 'MOON' ? (state.focusId ?? '') : ''
    /**
     * 真机反馈：手机屏（390px 宽）上把十几条全息标注全铺出来，
     * 左边的地貌带、右边的层结尺、顶上的抬头互相压字，什么都读不清。
     * 按方案书 §28 的 spatial progressive disclosure：
     * 手机上只出 Top 3~5 条——地貌留 3 条、层结留 3 条；放大 / 聚焦看的是
     * 球体本身，完整说明在下方档案里（那里一条不少）。
     * 桌面与 iPad 不受影响（仍是全量）。
     */
    const holoLimit = isPhoneLayout() ? 3 : Number.POSITIVE_INFINITY
    const features = bodyId ? (SURFACE_FEATURES[bodyId] ?? []).slice(0, holoLimit) : []
    const layers = bodyId ? (BODY_LAYERS_FULL[bodyId] ?? []).slice(0, holoLimit) : []

    const hideAll = () => {
      nodes.current.forEach((node) => (node.root.style.opacity = '0'))
      /**
       * v9.2：**3D 范围圈也必须一起隐藏**。
       * 之前这里只清了 DOM 标签，球面上的圆环留在场景里——
       * 于是"聚焦火星后退出，那几个圈还一直挂在火星上"。
       */
      ringsRef.current.forEach((ring) => (ring.visible = false))
      if (ringGroupRef.current) ringGroupRef.current.visible = false
      if (rulerRef.current) rulerRef.current.style.opacity = '0'
      if (captionRef.current) captionRef.current.style.opacity = '0'
    }
    if (!bodyId || (features.length === 0 && layers.length === 0)) {
      hideAll()
      return
    }
    // 有可显示的内容时，把圈组重新打开
    if (ringGroupRef.current) ringGroupRef.current.visible = true

    const world = getWorld(worldNow())
    const anchor = world.planets.get(bodyId as never) ?? world.moons.get(bodyId as never)
    if (!anchor) {
      hideAll()
      return
    }

    /**
     * 半径与姿态必须和渲染那一层用同一套公式，否则标注会"浮"在错误的纬度上。
     * 行星：axisQuaternion(orientation) 外层 + spinAngle 内层（与 PlanetBody 一致）
     * 月球：潮汐锁定 → tidalLockSpin（与 MoonBody 一致）
     */
    const planetDef = PLANETS.find((entry) => entry.id === bodyId)
    const moonEntry = MOON_BY_ID.get(bodyId)
    const moonDef = moonEntry?.moon
    const radius = bodyId === 'sun' ? SUN_RADIUS : (planetDef?.radius ?? moonDef?.radius ?? 0.5)
    const orientation = planetDef?.orientation ?? moonDef?.orientation
    const days = daysSinceJ2000(smoothYear())
    let spinY = 0
    if (planetDef && orientation) {
      spinY = spinAngle(orientation, days)
    } else if (moonDef && orientation) {
      const parent = world.planets.get((moonEntry?.planetId ?? 'earth') as never)
      spinY =
        moonDef.tidalLocked && parent
          ? tidalLockSpin(orientation, anchor.position, parent.position)
          : spinAngle(orientation, days)
    }
    const spin = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spinY)
    const axis = orientation ? axisQuaternion(orientation) : new THREE.Quaternion()
    const toWorld = axis.clone().multiply(spin)

    // 本体在屏幕上的中心与半径（临边刻度与范围圈都要用）
    const projected = new THREE.Vector3()
    const probe = new THREE.Vector3()
    probe.copy(anchor.position)
    projected.copy(probe).project(camera)
    const centerX = (projected.x * 0.5 + 0.5) * size.width
    const centerY = (-projected.y * 0.5 + 0.5) * size.height
    probe.copy(anchor.position).addScaledVector(new THREE.Vector3(1, 0, 0), radius)
    projected.copy(probe).project(camera)
    const radiusPx = Math.max(6, Math.abs((projected.x * 0.5 + 0.5) * size.width - centerX))

    const point = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const toCamera = new THREE.Vector3()
    const used = new Set<string>()

    features.forEach((feature: SurfaceFeature, index) => {
      const key = `${bodyId}:${feature.id}`
      used.add(key)
      let node = nodes.current.get(key)
      if (!node) {
        node = createFeatureNode(container, feature)
        nodes.current.set(key, node)
      }
      const lat = feature.lat * DEG
      const lon = feature.lon * DEG
      dir.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon))
      dir.applyQuaternion(toWorld).normalize()
      point.copy(anchor.position).addScaledVector(dir, radius * 1.004)
      toCamera.copy(camera.position).sub(point).normalize()
      const facing = dir.dot(toCamera)
      const visible = facing > 0.02 ? Math.min(1, (facing - 0.02) / 0.3) : 0

      projected.copy(point).project(camera)
      /**
       * 真机反馈：手机上右边的标签会伸到屏幕外（"AMALTHEA" 只剩半个字）。
       * 触屏设备把标签的落点夹在可视区内，引线仍然从球面锚点画出去。
       */
      const rawX = (projected.x * 0.5 + 0.5) * size.width
      const x = usesTopInset() ? Math.min(Math.max(rawX, 12), size.width - 154) : rawX
      const y = (-projected.y * 0.5 + 0.5) * size.height

      node.root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      node.root.style.opacity = (visible * 0.95).toFixed(3)

      /**
       * 范围圈是**球面上的 3D 圆环**（v8.1），在下面的 ring 组里更新。
       * DOM 这一侧只负责标签与引线——贴在球面上的线必须在 3D 里画，
       * 否则镜头一转它就"浮"在屏幕空间了。
       */
      if (feature.sizeDeg) {
        let ring = ringsRef.current.get(key)
        const wantedRadius = radius
        const builtFor = ring?.userData.radius as number | undefined
        if (ring && builtFor !== wantedRadius) {
          ringGroupRef.current?.remove(ring)
          ring.geometry.dispose()
          ringsRef.current.delete(key)
          ring = undefined
        }
        if (!ring) {
          const geometry = buildSurfaceRing(
            feature.lat,
            feature.lon,
            feature.sizeDeg,
            wantedRadius
          )
          ring = new THREE.LineLoop(geometry, holoRingMaterial)
          ring.userData.radius = wantedRadius
          ring.renderOrder = 3
          ringGroupRef.current?.add(ring)
          ringsRef.current.set(key, ring)
        }
        /**
         * 关键：每一帧只改这个环的**位置与朝向**。
         * 几何是固定的局部圆环，所以它永远贴在球面上那个经纬度处，
         * 镜头怎么转、行星怎么自转都不会漂。
         */
        ring.position.copy(anchor.position)
        ring.quaternion.copy(toWorld)
        ring.visible = visible > 0.12
      }
      /**
       * v8.3：地貌标签统一挂**左侧**，数据尺固定在**右侧**临边。
       * 之前两侧交替 + 数据尺也在右侧，结果标签和数据尺互相压字。
       * 竖向用 index 做一点错位，避免同纬度的几条挤在一起。
       */
      const stagger = (index % 3) * 12 - 12
      node.leader.style.transform = 'scaleX(-1)'
      node.label.style.transform = `translate3d(calc(-100% - 44px), ${(stagger + 10).toFixed(0)}px, 0)`
    })

    nodes.current.forEach((node, key) => {
      if (!used.has(key)) node.root.style.opacity = '0'
    })
    ringsRef.current.forEach((ring, key) => {
      if (!used.has(key)) ring.visible = false
    })

    // ---- 临边数据刻度：大气分层 / 内部结构 / 环系 ----
    if (layers.length > 0) {
      if (!rulerRef.current) {
        const node = document.createElement('div')
        node.className = 'holo-ruler'
        container.appendChild(node)
        rulerRef.current = node
      }
      const node = rulerRef.current
      node.innerHTML = layers
        .map(
          (layer) =>
            `<div class="holo-ruler__row"><b>${layer.name}</b><span>${layer.range}</span><em>${layer.nameCn}</em></div>`
        )
        .join('')
      // 数据尺推到右临边外侧一点，和左侧的地貌标签彻底分开
      /**
       * 手机上天体几乎占满宽度，原来的"推到半径外 1.24 倍"会直接跑到屏幕外面
       * （真机截图里层结尺被右边缘切掉）。触屏设备把它夹回可视区内。
       */
      const rulerRawX = centerX + radiusPx * 1.24
      const rulerX = usesTopInset()
        ? Math.min(rulerRawX, size.width - 168)
        : rulerRawX
      node.style.transform = `translate3d(${Math.max(12, rulerX).toFixed(1)}px, ${(centerY - layers.length * 12).toFixed(1)}px, 0)`
      node.style.opacity = '1'
    } else if (rulerRef.current) {
      rulerRef.current.style.opacity = '0'
    }

    // ---- 抬头 ----
    if (!captionRef.current) {
      const node = document.createElement('div')
      node.className = 'holo-caption'
      container.appendChild(node)
      captionRef.current = node
    }
    const text = HOLO_CAPTION[bodyId]
    const caption = captionRef.current
    caption.innerHTML = `<b>HOLOGRAPHIC ANALYSIS</b><span>${text?.zh ?? ''} · ${text?.en ?? ''}</span>`
    /**
     * 真机反馈：手机 / iPad 上这行抬头正好压在顶栏与"返回"按钮上。
     * 触屏设备给它一个上边界（顶栏 50px + 返回键 36px + 间距），
     * 天体再大也不会把标题顶到导航里。桌面不设限（topMin = 0）。
     */
    const captionTopMin = usesTopInset() ? 96 : 0
    caption.style.transform =
      `translate3d(${Math.max(24, centerX - radiusPx).toFixed(1)}px, ` +
      `${Math.max(captionTopMin, centerY - radiusPx * 1.22).toFixed(1)}px, 0)`
    /**
     * 手机上不显示这行抬头：屏宽 390px 时它一定和"太阳系总览"返回键、
     * 以及球面上方的两条地貌标签撞在一起（真机截图）。
     * §28 的 progressive disclosure 说的是"少而准"——手机上留 3 条地貌标注，
     * 抬头信息由下方档案承担。桌面 / iPad 保持原样。
     */
    caption.style.opacity = isPhoneLayout() ? '0' : '1'
  })

  // 3D 范围圈挂在这个组里；DOM 标签仍然写进 #holo-layer
  return <group ref={ringGroupRef} name="holo-rings" />
}

function createFeatureNode(container: HTMLElement, feature: SurfaceFeature): FeatureNode {
  const root = document.createElement('div')
  root.className = 'holo-node'
  root.style.opacity = '0'

  const dot = document.createElement('div')
  dot.className = 'holo-node__dot'
  root.appendChild(dot)

  const leader = document.createElement('div')
  leader.className = 'holo-node__leader'
  root.appendChild(leader)

  const label = document.createElement('div')
  label.className = 'holo-node__label'
  const name = document.createElement('span')
  name.className = 'holo-node__name'
  name.textContent = feature.name
  const meta = document.createElement('span')
  meta.className = 'holo-node__meta'
  meta.textContent = `${feature.nameCn} · ${feature.meta.zh}`
  label.append(name, meta)
  root.appendChild(label)

  container.appendChild(root)
  return { root, leader, label }
}
