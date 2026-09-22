import * as THREE from 'three'

// 轨道姿态（方案书 §3）。
//
// 每个天体系统同时拥有两套姿态：
//
//   ATLAS —— 盘面正对镜头。侧视图里每颗行星的卫星轨道都是完整的同心椭圆，
//            一眼就能读出"有几圈、谁在里面"。这是开场的默认状态。
//
//   REAL  —— 恢复真实的轨道倾角 / 升交点 / 偏心率。用户按下右键开始转视角时，
//            各条轨道按自己的相位差依次展开，不再正对镜头。
//
// 展开一旦发生就保持真实姿态；只有点击 BACK TO ATLAS 才重新压平。

export const orbitPose = {
  /** 当前展开进度 0..1（每帧平滑逼近 target） */
  value: 0,
  /** 目标展开进度 */
  target: 0,
  /** 动画起点（用于往返切换） */
  from: 0,
  /** 已经走过的动画时间（秒） */
  elapsed: 0,
  /** 是否正在做展开动画 */
  active: false,
}

/**
 * 展开动画的基准时长（v5 §5）。
 * 1.6~2.2 秒是为了让观众**看清楚**二维信息图是怎么解构成三维轨道的：
 * 太快就变成一次闪动，看不到"每条轨道各转各的角度"。
 */
export const UNFOLD_DURATION = 1.85

export function unfoldProgress(): number {
  return orbitPose.value
}

export function isUnfolding(): boolean {
  return orbitPose.active
}

/** 请求展开 / 压平轨道面 */
export function requestOrbitPose(target: 0 | 1, _now?: number): void {
  if (orbitPose.target === target && !orbitPose.active) return
  orbitPose.from = orbitPose.value
  orbitPose.target = target
  orbitPose.elapsed = 0
  orbitPose.active = true
}

/** 直接跳到某个姿态（深链、或从档案里一键还原时用） */
export function setOrbitPoseImmediate(value: 0 | 1): void {
  orbitPose.target = value
  orbitPose.value = value
  orbitPose.from = value
  orbitPose.elapsed = 0
  orbitPose.active = false
}

/** 每帧推进展开动画（由 CameraRig 调用，早于所有依赖轨道的组件） */
export function advanceOrbitPose(delta: number): void {
  if (!orbitPose.active) return
  orbitPose.elapsed += delta
  const k = Math.min(1, orbitPose.elapsed / UNFOLD_DURATION)
  // 两端缓入缓出：前 20% 几乎不动（Stage A），中间才是解构（Stage B/C）
  const eased = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
  orbitPose.value = orbitPose.from + (orbitPose.target - orbitPose.from) * eased
  if (k >= 1) {
    orbitPose.value = orbitPose.target
    orbitPose.active = false
  }
}

// ------------------------------------------------------------ 行星位置姿态
//
// 图谱有两种"行星在哪"：
//   SCHEMATIC —— 美术化排列，所有行星按同一条相位线排开，方便读图（默认）
//   REAL      —— 按当前时间轴年份的真实日心黄经摆开，读起来像一张真实的天文图
//
// 切换不是 snap：每颗行星有自己的延迟（Mercury 0ms → Pluto 900ms），
// 整张图像"展开一张真实轨道图"（方案书 §16）。

export const positionPose = {
  /** 当前混合值 0..1（0 = 图示排列，1 = 真实黄经） */
  value: 0,
  target: 0,
  from: 0,
  /** 已经走过的动画时间（秒） */
  elapsed: 0,
  /** 是否正在做"回归真实位置"的动画 */
  active: false,
}

/** 每颗行星的切换延迟（秒），按真实周期排序 */
export const POSITION_DELAY: Record<string, number> = {
  mercury: 0,
  venus: 0.12,
  earth: 0.24,
  mars: 0.36,
  jupiter: 0.48,
  saturn: 0.6,
  uranus: 0.72,
  neptune: 0.84,
  pluto: 0.96,
}

/** 全体完成需要的时间（秒）。v5 要求"至少 1 秒"，这里给到接近 2.3 秒。 */
export const POSITION_SWITCH_DURATION = 2.3
/** 单颗行星滑向真实位置用的时长 */
const POSITION_PER_PLANET = 1.3

export function requestPositionPose(target: 0 | 1): void {
  if (positionPose.target === target && positionPose.active) return
  positionPose.from = positionPose.value
  positionPose.target = target
  positionPose.elapsed = 0
  positionPose.active = true
}

export function setPositionPoseImmediate(value: 0 | 1): void {
  positionPose.target = value
  positionPose.value = value
  positionPose.from = value
  positionPose.elapsed = POSITION_SWITCH_DURATION
  positionPose.active = false
}

export function advancePositionPose(delta: number): void {
  if (!positionPose.active) return
  positionPose.elapsed += delta
  const k = Math.min(1, positionPose.elapsed / POSITION_SWITCH_DURATION)
  positionPose.value = positionPose.from + (positionPose.target - positionPose.from) * k
  if (positionPose.elapsed >= POSITION_SWITCH_DURATION) {
    positionPose.value = positionPose.target
    positionPose.active = false
  }
}

/**
 * 单颗行星此刻的滑行进度 0..1（带自己的延迟）。
 * 时间是显式的：整段动画约 2.3 秒，每颗行星晚 0.12 秒出发，
 * 于是"一排行星依次沿自己的轨道滑到真实黄经"这件事是看得见的（v5 §11）。
 */
export function positionBlend(id: string, elapsed = positionPose.elapsed): number {
  const delay = POSITION_DELAY[id] ?? 0
  const span = Math.max(POSITION_PER_PLANET, 0.2)
  const k = THREE.MathUtils.clamp((elapsed - delay) / span, 0, 1)
  const eased = k * k * (3 - 2 * k)
  return positionPose.from + (positionPose.target - positionPose.from) * eased
}

// ------------------------------------------------------------------ 哈希

/** 稳定的字符串哈希，返回 0..1，用来给每条轨道一个"性格" */
export function hash01(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/** 每条轨道的展开相位差 0..0.28：让"二维图展开成空间"逐条发生，看得清顺序 */
export function unfoldPhase(id: string): number {
  return hash01(`${id}:phase`) * 0.28
}

/** 这条轨道的展开时长倍率 0.55 ~ 0.7 */
export function unfoldStagger(id: string): number {
  return 0.55 + hash01(`${id}:stagger`) * 0.15
}

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)

// 单条轨道此刻的展开系数 0..1。
// 每条轨道用自己的相位差与时长，展开过程因此是"分散"的，而不是机械同步。
export function orbitUnfold(id: string, progress = orbitPose.value): number {
  const phase = unfoldPhase(id)
  const span = unfoldStagger(id)
  const k = (progress - phase) / span
  return k <= 0 ? 0 : k >= 1 ? 1 : easeOutCubic(k)
}

// -------------------------------------------------------------- 真实姿态

// 轨道倾角提示表。数据里没有逐条轨道要素，所以按轨道类型给出真实量级，
// 再用对象自己的哈希做 ±6° 抖动。凡是靠推断得到的一律标记为 syntheticOrbit。
const INCLINATION_HINTS: Array<[RegExp, number]> = [
  [/geostationary|geosynchronous/i, 0.4],
  [/sun-synchronous|polar|\bsso\b/i, 98],
  [/medium earth|navigation|gps|galileo|glonass|beidou/i, 55],
  [/molniya|elliptical/i, 63.4],
  [/lagrange|halo|libration/i, 22],
  [/interstellar|escape|heliocentric|deep space/i, 17],
  [/lunar|moon|cis-lunar/i, 88],
  [/areostationary|mars orbit/i, 25],
  [/low earth|\bleo\b|iss|earth orbit/i, 51.6],
]

export function realInclinationDeg(id: string, orbitClassEn: string): number {
  let base = 45
  for (const [pattern, value] of INCLINATION_HINTS) {
    if (pattern.test(orbitClassEn)) {
      base = value
      break
    }
  }
  // 归到 5° 一档：真实星座本来就是若干个轨道面，而不是每条轨道一个随机角度。
  // 这样展开之后读起来是"几层轨道壳"，不是一团乱线。
  const jitter = Math.round(((hash01(`${id}:inc`) - 0.5) * 10) / 5) * 5
  return THREE.MathUtils.clamp(base + jitter, 0, 120)
}

/** 升交点经度，由哈希给出，保证每次打开图谱都是同一张图 */
export function realNodeDeg(id: string): number {
  // 归到 12 个交点方向：与真实的星座分面一致
  return (Math.floor(hash01(`${id}:node`) * 12) / 12) * 360
}

/** 偏心率：低轨接近正圆，高轨 / 深空明显拉长 */
export function realEccentricity(id: string, orbitClassEn: string): number {
  if (/elliptical|molniya/i.test(orbitClassEn)) return 0.35 + hash01(`${id}:ecc`) * 0.25
  if (/lagrange|halo|libration/i.test(orbitClassEn)) return 0.12 + hash01(`${id}:ecc`) * 0.2
  if (/interstellar|escape|heliocentric|deep space/i.test(orbitClassEn))
    return 0.05 + hash01(`${id}:ecc`) * 0.1
  return 0.004 + hash01(`${id}:ecc`) * 0.05
}

/** 卫星（天体）的倾角：不规则卫星可以很陡，规则卫星接近赤道面 */
export function moonInclinationDeg(id: string): number {
  return Math.round(((hash01(`${id}:minc`) - 0.35) * 70) / 10) * 10
}

export function moonNodeDeg(id: string): number {
  return (Math.floor(hash01(`${id}:mnode`) * 8) / 8) * 360
}

// ------------------------------------------------------------------ 工具

const basisMatrix = new THREE.Matrix4()
const basisU = new THREE.Vector3()
const basisV = new THREE.Vector3()
const basisN = new THREE.Vector3()

// 由轨道要素构造"轨道面"的旋转基：u = 升交点方向，v = 面内垂直方向，
// n = u × v = 轨道面法线。倾角为 0 时法线就是黄道北 (0,1,0)。
export function planeQuaternion(
  inclinationDeg: number,
  nodeDeg: number,
  out = new THREE.Quaternion()
): THREE.Quaternion {
  const i = THREE.MathUtils.degToRad(inclinationDeg)
  const node = THREE.MathUtils.degToRad(nodeDeg)
  const ci = Math.cos(i)
  const si = Math.sin(i)
  const cn = Math.cos(node)
  const sn = Math.sin(node)
  basisU.set(cn, 0, sn)
  basisV.set(ci * sn, si, -ci * cn)
  basisN.crossVectors(basisU, basisV).normalize()
  basisMatrix.makeBasis(basisU, basisV, basisN)
  return out.setFromRotationMatrix(basisMatrix)
}

const realCache = new Map<string, THREE.Quaternion>()

/** 缓存的真实姿态四元数（每条轨道只算一次） */
export function realPlane(id: string, inclinationDeg: number, nodeDeg: number): THREE.Quaternion {
  const key = `${id}:${inclinationDeg.toFixed(1)}:${nodeDeg.toFixed(1)}`
  const cached = realCache.get(key)
  if (cached) return cached
  const quaternion = planeQuaternion(inclinationDeg, nodeDeg)
  realCache.set(key, quaternion)
  return quaternion
}
