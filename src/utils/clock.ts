import * as THREE from 'three'
import { timelineTime } from '../state/timelineTime'

// 世界时钟。
//
// 图谱里所有天体的位置都是 worldTime 的纯函数。把它与渲染时钟分开，
// 是为了让时间轴上的"回放这段时期"能真正改变场景的运动速度，
// 而不是只改一个年份文字。
export const timeControl = {
  value: 0,
  scale: 1,
  targetScale: 1,
}

export function advanceTime(delta: number): void {
  timeControl.scale += (timeControl.targetScale - timeControl.scale) * Math.min(1, delta * 2.2)
  if (Math.abs(timeControl.targetScale - timeControl.scale) < 0.002) {
    timeControl.scale = timeControl.targetScale
  }
  timeControl.value += Math.min(delta, 0.1) * timeControl.scale
}

/** 当前世界时刻（秒）。所有位置计算都必须用它。 */
export function worldNow(): number {
  return timeControl.value
}

export function setTimeScale(scale: number): void {
  timeControl.targetScale = THREE.MathUtils.clamp(scale, 0, 12)
}

/**
 * 平滑时间轴（v7 §13）。
 *
 * 时间轴上的 `timelineYear` 是**目标值**：用户拖动时它一跳一跳地变。
 * 如果所有天体直接读它，星历就是硬切——满屏物体"啪"地瞬移。
 * 这里维护一个追赶它的连续年份：天体的位置全部读这个值，
 * 于是拖动时间轴 = 所有行星 / 卫星 / 航天器 / 彗星沿各自轨道**连续**滑动。
 *
 * 追赶是有限速的：拖得越快，视觉上运动越快，但空间轨迹始终连续。
 */
export const yearControl = {
  value: 2026,
  /**
   * 追赶速度（v8 §51）：阻尼感来自"目标连续 + 慢追赶"。
   *
   * 目标年份现在是浮点（不再取整），这里用 5.0 的指数衰减：
   * 时间常数约 0.2 秒，拖动时是"星历在滑动"，停下后余韵约 0.6 秒收住。
   * 太快就是瞬移，太慢会跟不上手指。
   */
  rate: 5.0,
}

/** 每帧推进（由 CameraRig 在其它 useFrame 之前调用） */
export function advanceYear(delta: number): void {
  /**
   * V1.1 §5 / §6：追赶的是**连续目标**（timelineTime.target），
   * 不是 store 里那个按 50ms 节流写出来的 UI 年份。
   * 于是拖动时间轴时行星 / 月球 / 航天器 / 彗星是连续滑行；
   * 桌面端两条值永远相等，行为与 V1 一致。
   */
  const target = timelineTime.target
  const diff = target - yearControl.value
  if (Math.abs(diff) < 0.01) {
    yearControl.value = target
    return
  }
  yearControl.value += diff * Math.min(1, delta * yearControl.rate)
}

/** 当前**显示**年份：所有星历位置都用它，而不是 useAtlasStore 里的目标年份 */
export function smoothYear(): number {
  return yearControl.value
}

/** 直接落到某一年（深链、或从档案里跳年份时用） */
export function setSmoothYear(year: number): void {
  yearControl.value = year
  timelineTime.target = year
}
