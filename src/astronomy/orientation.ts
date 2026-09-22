import * as THREE from 'three'

/**
 * 天体姿态系统（v5 §15）。
 *
 * 自转轴不再是"随手给一个倾斜角"，而是用 IAU 的极轴（pole RA / Dec）算出来的：
 *   · 赤道坐标（RA/Dec）先转到黄道坐标，再映射到场景坐标
 *     （场景里 x = 黄道 X，y = 黄道 Z，z = 黄道 Y）
 *   · 本初子午线角 W = W0 + rate × (距 J2000 的天数)，自转因此与真实方向一致
 *
 * 数据来源：IAU WGCCRE 报告（行星与卫星自转要素），NASA/JPL 公开。
 */

/** 黄赤交角（J2000） */
const OBLIQUITY = THREE.MathUtils.degToRad(23.4392911)

const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0)

export interface BodyOrientation {
  /** 北极赤经，deg */
  poleRA: number
  /** 北极赤纬，deg */
  poleDec: number
  /** J2000 时的本初子午线角，deg */
  w0: number
  /** 自转角速度，deg/day（逆行天体为负） */
  rate: number
}

/**
 * 距 J2000 的天数（连续年份版本，v9.1）。
 *
 * 旧实现是 `Date.UTC(year, 0, 1)`：Date.UTC 会把年份字段取整，
 * 于是 2026.35 被当成 2026 —— 拖动时间轴时自转相位只在跨年瞬间跳一次，
 * 平时完全不动。现在按连续年份换算，自转随平滑年份连续推进。
 */
export function daysSinceJ2000(year: number): number {
  return (year - 2000) * 365.25
}

const poleScratch = new THREE.Vector3()

/**
 * 把 IAU 极轴（赤道坐标）换算成场景坐标下的单位向量。
 * 场景约定：x = 黄道 X，y = 黄道 Z（向上），z = 黄道 Y。
 */
export function poleToWorld(orientation: BodyOrientation, out = poleScratch): THREE.Vector3 {
  const ra = THREE.MathUtils.degToRad(orientation.poleRA)
  const dec = THREE.MathUtils.degToRad(orientation.poleDec)
  const xEq = Math.cos(dec) * Math.cos(ra)
  const yEq = Math.cos(dec) * Math.sin(ra)
  const zEq = Math.sin(dec)
  // 赤道 → 黄道
  const xEcl = xEq
  const yEcl = yEq * Math.cos(OBLIQUITY) + zEq * Math.sin(OBLIQUITY)
  const zEcl = -yEq * Math.sin(OBLIQUITY) + zEq * Math.cos(OBLIQUITY)
  return out.set(xEcl, zEcl, yEcl).normalize()
}

const upAxis = new THREE.Vector3(0, 1, 0)

/**
 * 天体自转轴的方向四元数：把本地 +Y 对齐到真实极轴。
 * 返回的四元数只负责"轴朝哪"，自转角由网格自己的 rotation.y 表示。
 */
export function axisQuaternion(
  orientation: BodyOrientation,
  out = new THREE.Quaternion()
): THREE.Quaternion {
  return out.setFromUnitVectors(upAxis, poleToWorld(orientation))
}

/** 本初子午线角（rad），由 W0 + rate × days 得到 */
export function spinAngle(orientation: BodyOrientation, days: number): number {
  const deg = orientation.w0 + orientation.rate * days
  return THREE.MathUtils.degToRad(((deg % 360) + 360) % 360)
}

/**
 * 潮汐锁定天体（月球、冥卫一…）的姿态：
 * 本初子午线永远朝向母体，也就是"永远同一面朝着行星"。
 * 这里直接求解：把本地 +X（本初子午线方向）转到指向母体的方向。
 */
export function tidalLockSpin(
  orientation: BodyOrientation,
  bodyPosition: THREE.Vector3,
  parentPosition: THREE.Vector3,
  out = new THREE.Vector3()
): number {
  const axis = poleToWorld(orientation, new THREE.Vector3())
  // 母体方向在"垂直于自转轴的平面"上的投影
  const toParent = out.subVectors(parentPosition, bodyPosition)
  toParent.addScaledVector(axis, -toParent.dot(axis))
  if (toParent.lengthSq() < 1e-8) return 0
  toParent.normalize()
  // 以极轴为参考，计算该方向在赤道面内的方位角
  const reference = new THREE.Vector3(1, 0, 0)
  if (Math.abs(reference.dot(axis)) > 0.9) reference.set(0, 0, 1)
  const tangent = new THREE.Vector3().crossVectors(axis, reference).normalize()
  const bitangent = new THREE.Vector3().crossVectors(axis, tangent).normalize()
  return Math.atan2(toParent.dot(bitangent), toParent.dot(tangent))
}
