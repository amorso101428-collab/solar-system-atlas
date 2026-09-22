import * as THREE from 'three'
import { PLANETS, SUN } from '../data/planets'
import { OBJECTS } from '../data/objects'
import type { MoonDef, PlanetDef, SpaceObject, SystemId } from '../data/types'
import { diskFrame, type DiskFrame } from './diskFrame'
import { ATLAS_OUTER_RADIUS, mapAuToVisual } from '../astronomy/visualScale'
import { axisQuaternion } from '../astronomy/orientation'
import {
  moonInclinationDeg,
  moonNodeDeg,
  orbitUnfold,
  positionBlend,
  realEccentricity,
  realInclinationDeg,
  realNodeDeg,
  realPlane,
} from './orbitPose'

// 图谱布局引擎。
// 位置 = 真实顺序压缩（displayDistance），尺寸 = 艺术化，轨道 = 图示椭圆。
// 所有位置都是时间 t 的纯函数，镜头、标签、轨道线共用同一份结果。
//
// 每个天体系统有一张"盘"：卫星轨道、航天器轨道、行星环都画在这张盘上。
// 盘有两种姿态（见 orbitPose.ts）：正对镜头的 ATLAS 姿态，以及真实 3D 姿态。

export const SUN_RADIUS = SUN.radius

/**
 * ATLAS 姿态下盘内轨道的压扁系数。
 *
 * **必须是 1**：侧视图里每颗行星的卫星轨道要读成"一圈一圈等距的正圆"，
 * 而不是同心椭圆。旧版写 0.78，椭圆在上下两个方向会缩到 78%，
 * 于是最内圈那条线会从土星环里穿过去（半径 8.9 的椭圆，短轴只剩 6.9 < 环的 8.5）。
 * 压扁交给展开之后的 REAL 姿态（那里用的是真实偏心率）。
 */
export const DISK_SQUASH = 1
const DISK_TILT_STEP = 0.1

/** 两颗相邻主要卫星之间的视觉间距上限（世界单位），超过就不再往外交错 */
const MAX_MOON_STEP = 1.55

/**
 * 每个行星的"主要卫星"：总览时只画这几圈的同心圆。
 *
 * 依据是"人类真正记住的那几颗"而不是半径阈值——旧版用 radius ≥ 0.25 筛，
 * 结果天王星一颗都不剩、土星只剩土卫六。这张表在 layout 与 Planets.tsx 之间共享。
 */
const PRIMARY_MOONS: Record<string, readonly string[]> = {
  earth: ['moon'],
  mars: ['phobos', 'deimos'],
  jupiter: ['io', 'europa', 'ganymede', 'callisto'],
  saturn: ['mimas', 'enceladus', 'titan', 'iapetus'],
  uranus: ['miranda', 'titania', 'oberon'],
  neptune: ['proteus', 'triton'],
  pluto: ['charon'],
}

// 图谱默认取景：以太阳为圆心、刚好装下最外圈同心轨道的一段范围。
// 相机不写死距离，由 ATLAS_OUTER_RADIUS 算出可见高度（v5 §4）。
export { ATLAS_OUTER_RADIUS }

// 每个天体系统的盘半径（世界单位）。
// 依据：**最内圈同心圆 = 行星本体（或星环）的 1.5 / 1.14 倍，
// 最外圈刚好落在盘边缘**，再加上与相邻行星 4 单位以上的净空。
// 土星的盘必须装下 2.35 倍半径的环 + 4 圈主要卫星，所以它比木星还大一圈。
// 改动 planets.ts 里的 displayDistance 时，必须同步复核这张表。
export const DISK_RADIUS: Record<string, number> = {
  sun: 8,
  mercury: 4,
  venus: 5.2,
  earth: 6.8,
  moon: 1.6,
  mars: 6,
  jupiter: 12.2,
  saturn: 14.5,
  uranus: 8.8,
  neptune: 6.7,
  pluto: 5,
  belt: 12,
}

/**
 * 三圈结构的**视觉**区间（v8 §14 / §17）。
 *
 * 旧版直接让 AU 曲线决定环带的视觉半径，结果小行星带正好压在
 * 火星的同心圆与木星的同心圆上（火星盘到 61、木星盘从 75.8 开始，
 * 而带体是 58.8–66.6 —— 两头都切进去）。现在改成"从盘外缘让开净空"：
 * 带体 = [火星盘外缘 + 2, 木星盘内缘 − 2]，行星怎么调间距它都自动跟着走。
 */
const BELT_RING_INNER = mapAuToVisual(1.524) + DISK_RADIUS.mars! + 2
const BELT_RING_OUTER = mapAuToVisual(5.203) - DISK_RADIUS.jupiter! - 2

/** 柯伊伯带同样让开海王星盘（6.7 + 6 净空），再向外铺开 45 单位 */
const KUIPER_INNER = mapAuToVisual(30.07) + DISK_RADIUS.neptune! + 6
const KUIPER_OUTER = KUIPER_INNER + 45

/**
 * 奥尔特云：外密内疏的**粒子壳**（v8 §18）。
 * 半径要落在柯伊伯带之外，形成"整个太阳系被一层粒子包住"的阅读。
 */
const OORT_INNER = KUIPER_OUTER + 18
const OORT_OUTER = OORT_INNER + 90

const templateCache = new Map<string, Float32Array>()

export function orbitTemplate(
  radius: number,
  squash = DISK_SQUASH,
  tilt = 0,
  segments = 160
): Float32Array {
  const key = `${radius.toFixed(3)}:${squash.toFixed(3)}:${tilt.toFixed(3)}:${segments}`
  const cached = templateCache.get(key)
  if (cached) return cached
  const points = new Float32Array(segments * 3)
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const x = Math.cos(theta) * radius
    const y = Math.sin(theta) * radius * squash
    points[i * 3 + 0] = x * ct - y * st
    points[i * 3 + 1] = x * st + y * ct
    points[i * 3 + 2] = 0
  }
  templateCache.set(key, points)
  return points
}

/**
 * 行星在轨道上的相位角（只用于图示排列）。
 *
 * **所有行星都停在各自轨道的 +x 端**，于是整排行星落在同一条水平线上——
 * 这就是"共面科普排列侧视图"该有的样子。旧版把 planet.phase 加进来，
 * 每颗行星停在自己轨道上的不同位置，再乘上各自的轨道倾角，
 * 结果水星比金星高、火星比地球低，一条水平线变成一条上下乱跳的折线。
 *
 * 呼吸幅度换算成"线位移恒定"（±0.9 单位），否则外行星会来回漂好几个单位，
 * 把好不容易留出来的系统间隙挤掉。
 */
function orbitAngle(planet: PlanetDef, t: number): number {
  const amplitude = 0.9 / planet.displayDistance
  const speed = 0.05 / Math.sqrt(planet.displayDistance)
  return Math.sin(t * speed + planet.phase * 5) * amplitude
}

// ---------------------------------------------------------------- 真实位置

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)
/** J2000 历元对应的"年"（用于把连续年份换算成天数） */
const J2000_YEAR = 2000
const DAYS_PER_YEAR = 365.25

/**
 * 由 J2000 轨道根数算出"这一年第一天"的日心黄经与黄纬。
 * 只做二体开普勒解，够把行星摆到正确的黄经上，不追求星历精度（方案书 §16）。
 */
function realHeliocentric(planet: PlanetDef, year: number): { lon: number; lat: number; ratio: number } {
  const el = planet.elements
  /**
   * v9.1：**必须用连续年份**。
   *
   * 旧写法是 `Date.UTC(year, 0, 1)`，而 JS 的 Date.UTC 会把各个字段取整——
   * 传进 2026.35 会被截成 2026。于是时间轴连续拖动时，行星的黄经只在
   * "跨年"那一瞬间跳一次，中间完全不动：这就是用户说的"到一个时间点就瞬移过来"。
   * 现在直接把年份差乘成天数，位置随平滑年份连续变化，行星沿轨道滑行。
   */
  const days = (year - J2000_YEAR) * DAYS_PER_YEAR
  const n = 360 / el.period
  const L = THREE.MathUtils.degToRad(el.l0 + n * days)
  const peri = THREE.MathUtils.degToRad(el.peri)
  const node = THREE.MathUtils.degToRad(el.node)
  const inc = THREE.MathUtils.degToRad(el.i)

  // 平近点角 → 偏近点角（牛顿迭代 4 次足够收敛到 1e-6）
  let M = L - peri
  M = Math.atan2(Math.sin(M), Math.cos(M))
  let E = M
  for (let i = 0; i < 5; i++) {
    E -= (E - el.e * Math.sin(E) - M) / (1 - el.e * Math.cos(E))
  }
  const nu = 2 * Math.atan2(Math.sqrt(1 + el.e) * Math.sin(E / 2), Math.sqrt(1 - el.e) * Math.cos(E / 2))
  const r = el.a * (1 - el.e * Math.cos(E))
  const u = nu + (peri - node)

  const x = r * (Math.cos(node) * Math.cos(u) - Math.sin(node) * Math.sin(u) * Math.cos(inc))
  const y = r * (Math.sin(node) * Math.cos(u) + Math.cos(node) * Math.sin(u) * Math.cos(inc))
  const z = r * Math.sin(u) * Math.sin(inc)

  return { lon: Math.atan2(y, x), lat: Math.atan2(z, Math.hypot(x, y)), ratio: r / el.a }
}

export function planetPosition(
  planet: PlanetDef,
  t: number,
  year = 2026,
  target = new THREE.Vector3()
): THREE.Vector3 {
  const blend = positionBlend(planet.id)
  if (blend >= 0.999) {
    const real = realHeliocentric(planet, year)
    const r = planet.displayDistance * real.ratio
    target.set(
      Math.cos(real.lon) * r,
      Math.sin(real.lat) * r,
      Math.sin(real.lon) * r
    )
    return target
  }

  const theta = orbitAngle(planet, t)
  const a = planet.displayDistance
  const b = a * (1 - planet.orbitEcc)
  const x = Math.cos(theta) * a
  const z = Math.sin(theta) * b
  target.set(x, z * Math.sin(planet.orbitIncl), z * Math.cos(planet.orbitIncl))
  if (blend > 0.001) {
    const real = realHeliocentric(planet, year)
    const r = planet.displayDistance * real.ratio
    // 沿轨道滑过去：角度和半径分别插值，走的是弧线而不是直线（v5 §11）
    const startAngle = Math.atan2(target.z, target.x)
    let delta = real.lon - startAngle
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    const angle = startAngle + delta * blend
    const radius = THREE.MathUtils.lerp(Math.hypot(target.x, target.z), r, blend)
    const height = THREE.MathUtils.lerp(target.y, Math.sin(real.lat) * r, blend)
    target.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius)
  }
  return target
}

export function orbitSample(planet: PlanetDef, segments = 220): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  const a = planet.displayDistance
  const b = a * (1 - planet.orbitEcc)
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    const x = Math.cos(theta) * a
    const z = Math.sin(theta) * b
    points.push(new THREE.Vector3(x, z * Math.sin(planet.orbitIncl), z * Math.cos(planet.orbitIncl)))
  }
  return points
}

const orbitPointsCache = new Map<string, THREE.Vector3[]>()
function orbitPointsOf(planet: PlanetDef): THREE.Vector3[] {
  const cached = orbitPointsCache.get(planet.id)
  if (cached) return cached
  const points = orbitSample(planet)
  orbitPointsCache.set(planet.id, points)
  return points
}

// 盘上的一圈轨道，带这一帧的姿态
export interface DiskOrbit {
  id: string
  kind: 'moon' | 'object'
  radius: number
  tilt: number
  squash: number
  quaternion: THREE.Quaternion
  unfold: number
  importance: number
  /** 轨道开口的相位（0..1）与速度（圈/秒）：开口永远落在自己的天体上 */
  gapPhase: number
  gapSpeed: number
  /** 天然卫星里的"主要卫星"（月球 / 伽利略卫星 / 土卫六 / 海卫一） */
  majorMoon: boolean
}

export interface SystemDisk {
  id: SystemId
  center: THREE.Vector3
  radius: number
  squash: number
  // 盘整体姿态（行星环用：ATLAS -> 行星赤道面）
  quaternion: THREE.Quaternion
  unfold: number
  orbits: DiskOrbit[]
}

export interface PlanetAnchor {
  planet: PlanetDef
  position: THREE.Vector3
  orbitPoints: THREE.Vector3[]
  diskId: SystemId
}

export interface MoonAnchor {
  id: string
  name: string
  nameCn: string
  def: MoonDef
  position: THREE.Vector3
  planetId: SystemId
  diskId: SystemId
  radius: number
  tilt: number
}

export interface ObjectAnchor {
  object: SpaceObject
  position: THREE.Vector3
  parent: THREE.Vector3
  ringRadius: number
  angle: number
  labelSide: 1 | -1
  deep: boolean
  trajectory?: THREE.Vector3[]
  diskId: SystemId | null
  tilt: number
}

export interface Layout {
  planets: PlanetAnchor[]
  systems: SystemDisk[]
  moons: MoonAnchor[]
  objects: ObjectAnchor[]
  regions: RegionAnchor[]
  asteroidBelt: Float32Array
  kuiperBelt: Float32Array
  oortCloud: Float32Array
  trajectories: THREE.Vector3[][]
}

/** 小行星带 / 柯伊伯带 / 奥尔特云：可以像天体一样被选中、被镜头聚焦 */
export interface RegionAnchor {
  id: 'asteroid' | 'kuiper' | 'oort'
  name: string
  nameCn: string
  center: THREE.Vector3
  inner: number
  outer: number
  /** 取景半径：让整圈结构刚好落在画面里 */
  radius: number
  particles: number
  note: string
}

function mulberry(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

// 环形粒子带。刻意做成"不均匀"：密度径向衰减 + 若干段空档（柯克伍德间隙的味道），
// 而不是一条均匀的白圆环。
function seededRing(
  count: number,
  inner: number,
  outer: number,
  thickness: number,
  seed: number,
  options: { gaps?: boolean; bias?: number } = {}
): Float32Array {
  const positions = new Float32Array(count * 3)
  const rand = mulberry(seed)
  const gaps = options.gaps ?? false
  const bias = options.bias ?? 0.6
  let written = 0
  let guard = 0
  while (written < count && guard < count * 12) {
    guard++
    const t = Math.pow(rand(), bias)
    const r = inner + (outer - inner) * t
    if (gaps) {
      const norm = (r - inner) / Math.max(outer - inner, 1e-4)
      const gap = Math.min(Math.abs(norm - 0.28), Math.abs(norm - 0.55), Math.abs(norm - 0.76))
      if (gap < 0.028 && rand() > 0.22) continue
    }
    const theta = rand() * Math.PI * 2
    const jitter = 0.85 + rand() * 0.3
    positions[written * 3 + 0] = Math.cos(theta) * r * jitter
    positions[written * 3 + 1] = (rand() - 0.5) * thickness
    positions[written * 3 + 2] = Math.sin(theta) * r * jitter
    written++
  }
  return positions.subarray(0, written * 3) as Float32Array
}

// 奥尔特云：球壳，不是盘
/**
 * 球壳粒子（v8 §18）。
 *
 * `bias` 是幂次：0.5 是均匀，**0.35 让粒子明显偏向外层**——
 * 用户要的不是一个菲涅尔球，而是"中心稀、外圈密的粒子壳"，
 * 由粒子密度本身形成包裹感。
 */
function seededShell(
  count: number,
  inner: number,
  outer: number,
  seed: number,
  bias = 0.35
): Float32Array {
  const positions = new Float32Array(count * 3)
  const rand = mulberry(seed)
  for (let i = 0; i < count; i++) {
    const r = inner + (outer - inner) * Math.pow(rand(), bias)
    const u = rand() * 2 - 1
    const phi = rand() * Math.PI * 2
    const s = Math.sqrt(Math.max(0, 1 - u * u))
    positions[i * 3 + 0] = r * s * Math.cos(phi)
    positions[i * 3 + 1] = r * u
    positions[i * 3 + 2] = r * s * Math.sin(phi)
  }
  return positions
}

// 深空探测器：真实顺序 x 更远的横向跨度，形成"飞出太阳系"的阅读方向
function deepPosition(index: number): THREE.Vector3 {
  const x = 134 + index * 9
  const y = Math.sin(index * 1.7) * 4
  const z = Math.cos(index * 1.1) * 8 - index * 0.4
  return new THREE.Vector3(x, y, z)
}

/**
 * 三条大尺度粒子带（v6 §12 性能）。
 *
 * 它们的种子是常量、不随时间变化，所以**只生成一次**。
 * 旧版把这三行放在 computeLayout 里：每帧都要重跑 16400 次随机数并分配
 * 三个 Float32Array —— 拖动 / 缩放时的顿挫有相当一部分来自这里。
 */
/**
 * v7.2：5200 → 16000。
 *
 * 上一版把近景的可见粒子砍到 32%，结果推近之后"根本看不出来有一片小行星带"。
 * 现在粒子的**出现**由每颗自己的阈值控制（见 Orbits 的 aReveal）：
 * 远景只露出最早的那一批，推近才逐颗浮现。数量要给足，近景才有细节可看。
 */
// v8.1：厚度 2.4 → 0.8。侧视图里原来的带宽和小行星直径相当，
// 读起来像一条厚实的带子；缩到三分之一之后才像"薄薄一层尘"。
const ASTEROID_BELT = seededRing(16000, BELT_RING_INNER, BELT_RING_OUTER, 0.8, 20260901, {
  gaps: true,
  bias: 0.72,
})
// 柯伊伯带：外缘稍密（bias < 1），数量给足，远景才看得成"一条带"
const KUIPER_BELT = seededRing(14000, KUIPER_INNER, KUIPER_OUTER, 9, 77123, { bias: 0.62 })
// 奥尔特云：外密内疏的粒子壳（v8 §18），数量从 4200 提到 16000
const OORT_CLOUD = seededShell(16000, OORT_INNER, OORT_OUTER, 424242, 0.35)

const scratch = new THREE.Vector2()
function diskOffset(theta: number, radius: number, tilt: number, squash: number): THREE.Vector2 {
  const x = Math.cos(theta) * radius
  const y = Math.sin(theta) * radius * squash
  const ct = Math.cos(tilt)
  const st = Math.sin(tilt)
  scratch.set(x * ct - y * st, x * st + y * ct)
  return scratch
}

const scratchVec = new THREE.Vector3()

function placeByQuaternion(
  center: THREE.Vector3,
  u: number,
  v: number,
  quaternion: THREE.Quaternion
): THREE.Vector3 {
  scratchVec.set(u, v, 0).applyQuaternion(quaternion)
  return new THREE.Vector3(
    center.x + scratchVec.x,
    center.y + scratchVec.y,
    center.z + scratchVec.z
  )
}

// 航天器在盘内的展开弧：从左上绕过下方铺开
function arcTheta(index: number, count: number): number {
  if (count === 1) return -Math.PI * 0.3
  const spread = Math.min(Math.PI * 1.7, Math.max(count * 0.5, Math.PI * 0.55))
  const start = -Math.PI * 0.62 - spread * 0.5
  return start + (spread * index) / (count - 1)
}

interface RingPlanEntry {
  object: SpaceObject
  radius: number
  tilt: number
  theta: number
}

function planRings(
  objects: SpaceObject[],
  inner: number,
  outer: number,
  perRing: number
): RingPlanEntry[] {
  const ringCount = Math.max(1, Math.ceil(objects.length / perRing))
  const step = ringCount > 1 ? (outer - inner) / (ringCount - 1) : 0
  const entries: RingPlanEntry[] = []
  for (let ring = 0; ring < ringCount; ring++) {
    const members = objects.slice(ring * perRing, (ring + 1) * perRing)
    const radius = inner + step * ring
    const tilt = ring * DISK_TILT_STEP
    members.forEach((object, index) => {
      const theta = arcTheta(index, members.length) + ring * 0.55
      entries.push({ object, radius, tilt, theta })
    })
  }
  return entries
}

/**
 * 天然卫星的同心圆半径（v6 §1）。
 *
 * 规则只有两条，但正是"一圈一圈等距的正圆"的来源：
 *   1) 主要卫星在 [inner, outer] 上**等距**排开，间距上限 MAX_MOON_STEP；
 *   2) 其余小卫星按**真实轨道顺序**插在相邻两颗主要卫星之间。
 *
 * 于是总览里看到的那几圈永远是等距的（Planets.tsx 的 LOD 只画主要卫星），
 * 推近之后补上来的小卫星也不会打乱这个秩序，而是填进已有的间隔里。
 */
function planMoonOrbits(
  planetId: string,
  moons: MoonDef[],
  inner: number,
  outer: number,
  planetRadius: number,
  ringOuter: number
): Array<{ radius: number; primary: boolean }> {
  const primaryIds = new Set(PRIMARY_MOONS[planetId] ?? [])
  const radii = new Array<number>(moons.length).fill(0)
  const primaryIndex: number[] = []
  moons.forEach((moon, index) => {
    if (primaryIds.has(moon.id)) primaryIndex.push(index)
  })

  const span = Math.max(outer - inner, 0.5)

  if (!primaryIndex.length) {
    // 没有主要卫星：全部等距，反正它们只在推近之后才出现
    const step = moons.length > 1 ? span / (moons.length - 1) : 0
    moons.forEach((_, index) => {
      radii[index] = inner + step * index
    })
    return radii.map((radius) => ({ radius, primary: false }))
  }

  const step =
    primaryIndex.length > 1
      ? Math.min(span / (primaryIndex.length - 1), MAX_MOON_STEP)
      : 0
  primaryIndex.forEach((index, order) => {
    radii[index] = order === 0 ? inner : inner + step * order
  })

  // 小卫星：夹在相邻两颗主要卫星之间插值，真实顺序不被打乱
  const innerFloor = Math.max(planetRadius * 1.22, ringOuter * 1.05)
  moons.forEach((_, index) => {
    if (radii[index]! > 0) return
    let prev = -1
    let next = -1
    for (const p of primaryIndex) {
      if (p < index) prev = p
      if (p > index && next < 0) next = p
    }
    if (prev >= 0 && next >= 0) {
      const k = (index - prev) / (next - prev)
      radii[index] = THREE.MathUtils.lerp(radii[prev]!, radii[next]!, k)
    } else if (next >= 0) {
      // 主要卫星之前的小卫星（木卫五、土星的四颗环卫）：贴着本体排在最里圈
      const first = primaryIndex[0]!
      const k = (index + 1) / (first + 1)
      radii[index] = THREE.MathUtils.lerp(Math.min(innerFloor, radii[first]!), radii[first]!, k)
    } else {
      const last = primaryIndex[primaryIndex.length - 1]!
      const k = (index - last) / (moons.length - last)
      radii[index] = THREE.MathUtils.lerp(radii[last]!, outer, k)
    }
  })

  return radii.map((radius, index) => ({ radius, primary: primaryIds.has(moons[index]!.id) }))
}

export function computeLayout(t: number, frame: DiskFrame = diskFrame, year = 2026): Layout {
  const planets: PlanetAnchor[] = []

  for (const planet of PLANETS) {
    planets.push({
      planet,
      position: planetPosition(planet, t, year),
      orbitPoints: orbitPointsOf(planet),
      diskId: planet.id,
    })
  }

  const groups = new Map<SystemId, SpaceObject[]>()
  for (const object of OBJECTS) {
    const list = groups.get(object.system) ?? []
    list.push(object)
    groups.set(object.system, list)
  }
  const groupOf = (id: SystemId) => groups.get(id) ?? []

  const systems: SystemDisk[] = []
  const moons: MoonAnchor[] = []
  const objects: ObjectAnchor[] = []
  const trajectories: THREE.Vector3[][] = []

  const atlasQuat = new THREE.Quaternion().setFromRotationMatrix(frame.matrix)

  const makeOrbit = (
    id: string,
    kind: 'moon' | 'object',
    radius: number,
    tilt: number,
    inclinationDeg: number,
    nodeDeg: number,
    eccentricity: number,
    importance: number,
    gapPhase: number,
    gapSpeed: number,
    majorMoon = false
  ): DiskOrbit => {
    const k = orbitUnfold(id)
    const quaternion = new THREE.Quaternion()
      .copy(atlasQuat)
      .slerp(realPlane(id, inclinationDeg, nodeDeg), k)
    // ATLAS 略微压扁，REAL 时交还给真实偏心率
    const squash = DISK_SQUASH + (1 - DISK_SQUASH) * k - eccentricity * k
    return {
      id,
      kind,
      radius,
      tilt,
      squash,
      quaternion,
      unfold: k,
      importance,
      gapPhase,
      gapSpeed,
      majorMoon,
    }
  }

  const pushObject = (
    object: SpaceObject,
    center: THREE.Vector3,
    diskId: SystemId,
    orbit: DiskOrbit,
    theta: number,
    index: number
  ) => {
    const offset = diskOffset(theta, orbit.radius, orbit.tilt, orbit.squash)
    objects.push({
      object,
      position: placeByQuaternion(center, offset.x, offset.y, orbit.quaternion),
      parent: center.clone(),
      ringRadius: orbit.radius,
      angle: theta,
      labelSide: index % 2 === 0 ? 1 : -1,
      deep: false,
      diskId,
      tilt: orbit.tilt,
    })
  }

  // ---- 行星系统：航天器在内圈，卫星在外圈 ----
  for (const anchor of planets) {
    const def = anchor.planet
    const diskRadius = DISK_RADIUS[def.id] ?? def.radius + 2.5
    const ringOuter = def.rings ? def.radius * def.rings.outer : 0
    /**
     * 最内圈同心圆的位置。两条硬约束：
     *   本体 1.5 倍（否则轨道糊在行星脸上）；
     *   有环的行星让开 1.14 倍环外缘（否则轨道线切进土星环——
     *   旧版算的是"环外缘 + 0.45"，压扁成椭圆之后短轴反而缩进环里）。
     */
    const inner = Math.max(def.radius * 1.5, ringOuter * 1.14)
    const available = Math.max(diskRadius - 0.25 - inner, 0.4)
    const orbits: DiskOrbit[] = []
    const spacecraft = groupOf(def.id)

    // 盘整体姿态：ATLAS 正对镜头，REAL 跟随行星自转轴
    const systemUnfold = orbitUnfold(`${def.id}:system`)
    const ringQuat = new THREE.Quaternion()
      .copy(atlasQuat)
      // REAL 姿态直接用 IAU 极轴：卫星轨道与行星环都躺在真实的赤道面上（v5 §15）
      .slerp(axisQuaternion(def.orientation, new THREE.Quaternion()), systemUnfold)

    if (spacecraft.length) {
      const hasMoons = def.moons.length > 0
      const share = spacecraft.length > 14 ? 0.52 : spacecraft.length > 6 ? 0.42 : 0.3
      const outer = hasMoons
        ? inner + available * share
        : diskRadius - 0.25
      const perRing = spacecraft.length > 14 ? 5 : spacecraft.length > 8 ? 3 : 1
      const entries = planRings(spacecraft, inner, outer, perRing)
      entries.forEach((entry, index) => {
        const orbit = makeOrbit(
          entry.object.id,
          'object',
          entry.radius,
          entry.tilt,
          realInclinationDeg(entry.object.id, entry.object.orbitClass.en),
          realNodeDeg(entry.object.id),
          realEccentricity(entry.object.id, entry.object.orbitClass.en),
          entry.object.importance ?? 2,
          entry.theta / (Math.PI * 2),
          0
        )
        orbits.push(orbit)
        pushObject(entry.object, anchor.position, def.id, orbit, entry.theta, index)
      })
    }

    if (def.moons.length) {
      const moonOuter = diskRadius - 0.25
      // 有人造卫星的行星：卫星同心圆从航天器那一圈之外开始，两者不互相穿插
      const moonInner = Math.min(
        spacecraft.length
          ? inner + available * (spacecraft.length > 14 ? 0.52 : spacecraft.length > 6 ? 0.42 : 0.3) + 0.5
          : inner,
        moonOuter - 0.6
      )
      const plan = planMoonOrbits(def.id, def.moons, moonInner, moonOuter, def.radius, ringOuter)
      def.moons.forEach((moon, index) => {
        const entry = plan[index]!
        const radius = entry.radius
        const tilt = index * DISK_TILT_STEP * 0.5
        const orbit = makeOrbit(
          moon.id,
          'moon',
          radius,
          tilt,
          moonInclinationDeg(moon.id),
          moonNodeDeg(moon.id),
          0.02,
          1,
          (def.phase + moon.orbitRadius * 2.1) / (Math.PI * 2),
          0.06 / (Math.PI * 2),
          entry.primary
        )
        orbits.push(orbit)
        const theta = t * 0.06 + def.phase + moon.orbitRadius * 2.1
        const offset = diskOffset(theta, radius, tilt, orbit.squash)
        moons.push({
          id: moon.id,
          name: moon.name,
          nameCn: moon.nameCn,
          def: moon,
          position: placeByQuaternion(anchor.position, offset.x, offset.y, orbit.quaternion),
          planetId: def.id,
          diskId: def.id,
          radius,
          tilt,
        })
      })
    }

    systems.push({
      id: def.id,
      center: anchor.position.clone(),
      radius: diskRadius,
      squash: DISK_SQUASH,
      quaternion: ringQuat,
      unfold: systemUnfold,
      orbits,
    })
  }

  // ---- 太阳：太阳观测器在太阳盘上展开 ----
  {
    const solar = groupOf('sun')
    const inner = SUN_RADIUS + 0.9
    const outer = DISK_RADIUS.sun - 0.15
    const center = new THREE.Vector3()
    const orbits: DiskOrbit[] = []
    planRings(solar, inner, outer, 1).forEach((entry, index) => {
      const orbit = makeOrbit(
        entry.object.id,
        'object',
        entry.radius,
        entry.tilt,
        realInclinationDeg(entry.object.id, entry.object.orbitClass.en),
        realNodeDeg(entry.object.id),
        realEccentricity(entry.object.id, entry.object.orbitClass.en),
        entry.object.importance ?? 2,
        entry.theta / (Math.PI * 2),
        0
      )
      orbits.push(orbit)
      pushObject(entry.object, center, 'sun', orbit, entry.theta, index)
    })
    systems.push({
      id: 'sun',
      center,
      radius: DISK_RADIUS.sun,
      squash: DISK_SQUASH,
      quaternion: new THREE.Quaternion()
        .copy(atlasQuat)
        .slerp(realPlane('sun:spin', 7.25, 0), orbitUnfold('sun:system')),
      unfold: orbitUnfold('sun:system'),
      orbits,
    })
  }

  // ---- 小行星带任务：夹在火星与木星之间的那圈上 ----
  {
    const belt = groupOf('belt')
    const center = new THREE.Vector3()
    const orbits: DiskOrbit[] = []
    belt.forEach((object, index) => {
      const radius =
        belt.length > 1
          ? BELT_RING_INNER + ((BELT_RING_OUTER - BELT_RING_INNER) * index) / (belt.length - 1)
          : (BELT_RING_INNER + BELT_RING_OUTER) / 2
      const tilt = index * 0.06
      const orbit = makeOrbit(
        object.id,
        'object',
        radius,
        tilt,
        12,
        realNodeDeg(object.id),
        realEccentricity(object.id, object.orbitClass.en),
        object.importance ?? 2,
        arcTheta(index, belt.length) / (Math.PI * 2),
        0
      )
      orbits.push(orbit)
      pushObject(object, center, 'belt', orbit, arcTheta(index, belt.length), index)
    })
    systems.push({
      id: 'belt',
      center,
      radius: BELT_RING_OUTER,
      squash: DISK_SQUASH,
      quaternion: new THREE.Quaternion()
        .copy(atlasQuat)
        .slerp(realPlane('belt:system', 8, 40), orbitUnfold('belt:system')),
      unfold: orbitUnfold('belt:system'),
      orbits,
    })
  }

  // ---- 月球自己的小盘：嵌在地球盘里，围着月球转 ----
  {
    const moonAnchor = moons.find((anchor) => anchor.id === 'moon')
    const lunar = groupOf('moon')
    if (moonAnchor && lunar.length) {
      const diskRadius = DISK_RADIUS.moon
      const inner = moonAnchor.def.radius + 0.42
      const outer = diskRadius - 0.05
      const center = moonAnchor.position.clone()
      const orbits: DiskOrbit[] = []
      planRings(lunar, inner, outer, 4).forEach((entry, index) => {
        const orbit = makeOrbit(
          entry.object.id,
          'object',
          entry.radius,
          entry.tilt,
          realInclinationDeg(entry.object.id, entry.object.orbitClass.en),
          realNodeDeg(entry.object.id),
          realEccentricity(entry.object.id, entry.object.orbitClass.en),
          entry.object.importance ?? 2,
          entry.theta / (Math.PI * 2),
          0
        )
        orbits.push(orbit)
        pushObject(entry.object, center, 'moon', orbit, entry.theta, index)
      })
      systems.push({
        id: 'moon',
        center,
        radius: diskRadius,
        squash: DISK_SQUASH,
        quaternion: new THREE.Quaternion()
          .copy(atlasQuat)
          .slerp(realPlane('moon:system', 5.1, 125), orbitUnfold('moon:system')),
        unfold: orbitUnfold('moon:system'),
        orbits,
      })
    }
  }

  // ---- 深空：飞出太阳系的阅读方向 ----
  {
    const deepObjects = groupOf('deep')
    const origin = new THREE.Vector3(SUN_RADIUS + 1, 0, 0)
    deepObjects.forEach((object, index) => {
      const position = deepPosition(index)
      const trajectory: THREE.Vector3[] = []
      for (let i = 0; i <= 72; i++) {
        const k = i / 72
        const point = new THREE.Vector3().lerpVectors(origin, position, k)
        point.y += Math.sin(k * Math.PI) * 7
        point.z += Math.sin(k * Math.PI) * 16 * (index % 2 === 0 ? 1 : -1)
        trajectory.push(point)
      }
      trajectories.push(trajectory)
      objects.push({
        object,
        position,
        parent: origin.clone(),
        ringRadius: 0,
        angle: 0,
        labelSide: index % 2 === 0 ? 1 : -1,
        deep: true,
        trajectory,
        diskId: null,
        tilt: 0,
      })
    })
  }

  return {
    planets,
    systems,
    moons,
    objects,
    regions: REGIONS,
    asteroidBelt: ASTEROID_BELT,
    kuiperBelt: KUIPER_BELT,
    oortCloud: OORT_CLOUD,
    trajectories,
  }
}

export const BELT_RANGE = { inner: BELT_RING_INNER, outer: BELT_RING_OUTER }
export const KUIPER_RANGE = { inner: KUIPER_INNER, outer: KUIPER_OUTER }
export const OORT_RANGE = { inner: OORT_INNER, outer: OORT_OUTER }

/**
 * 三圈大尺度结构。它们不是背景装饰：可以点击、可以聚焦、可以在档案里读到数据
 * （方案书 §18）。粒子数只用于面板展示，真正的粒子密度在 Orbits 里切换。
 */
export const REGIONS: RegionAnchor[] = [
  {
    id: 'asteroid',
    name: 'ASTEROID BELT',
    nameCn: '小行星带',
    center: new THREE.Vector3(0, 0, 0),
    inner: BELT_RING_INNER,
    outer: BELT_RING_OUTER,
    radius: (BELT_RING_INNER + BELT_RING_OUTER) / 2,
    particles: 16000,
    note: '火星与木星之间的小天体密集区，也是多数小行星探测任务的目的地。',
  },
  {
    id: 'kuiper',
    name: 'KUIPER BELT',
    nameCn: '柯伊伯带',
    center: new THREE.Vector3(0, 0, 0),
    inner: KUIPER_INNER,
    outer: KUIPER_OUTER,
    radius: (KUIPER_INNER + KUIPER_OUTER) / 2,
    particles: 14000,
    note: '海王星之外的冰质天体带：冥王星、妊神星、鸟神星都在这里。粒子外缘稍密，读起来是一条向外散开的盘。',
  },
  {
    id: 'oort',
    name: 'OORT CLOUD',
    nameCn: '奥尔特云',
    center: new THREE.Vector3(0, 0, 0),
    inner: OORT_INNER,
    outer: OORT_OUTER,
    radius: (OORT_INNER + OORT_OUTER) / 2,
    particles: 16000,
    note: '太阳系的稀薄外缘，长周期彗星的来源。这里用**外密内疏的粒子壳**表示——外层粒子明显多于内层，密度本身就是"包裹"的观感。',
  },
]
