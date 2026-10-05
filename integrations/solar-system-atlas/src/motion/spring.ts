/**
 * 统一弹簧积分器（V1.1 §4 / §7）。
 *
 * Timeline 抽屉、Bottom Sheet、以及任何"跟手 + 松手吸附"的东西都共用这一个
 * 实现。两条纪律：
 *
 *   1. **不做离散判断**。禁止 `if (dragY > threshold) setExpanded(true)` ——
 *      位置永远是连续的浮点数，档位只是它吸附之后的结果。
 *   2. **不每帧写 React state**。物理量保存在模块级对象里，由 rAF 直接写
 *      CSS 变量；React 只负责最终档位这类"低频"信息。
 *
 * 方程：x'' = -k(x - target) - c·x'
 *   k = 260 / c = 30 是方案书给的起点，真机手感按需微调。
 */

export interface SpringOptions {
  stiffness?: number
  damping?: number
  /** 小于这个值就认为"停住了"（单位/秒） */
  restVelocity?: number
  /** 距目标小于这个值且速度足够小 → 直接落位 */
  restDistance?: number
}

export interface SpringState {
  /** 当前位置 */
  position: number
  velocity: number
  /** 目标位置 */
  target: number
}

export const SPRING_DEFAULTS = {
  stiffness: 260,
  damping: 30,
  restVelocity: 0.05,
  restDistance: 0.05,
}

export function createSpring(position: number, target = position): SpringState {
  return { position, velocity: 0, target }
}

/**
 * 推进一帧。返回 true 表示还在动（调用方据此决定要不要继续 rAF）。
 *
 * 用半隐式欧拉 + 子步进：手机上一帧可能给到 40ms（掉帧时更长），
 * 单步积分在 k=260 下会直接发散成"抖动"，所以按 8ms 切片。
 */
export function stepSpring(
  state: SpringState,
  deltaMs: number,
  options: SpringOptions = {}
): boolean {
  const k = options.stiffness ?? SPRING_DEFAULTS.stiffness
  const c = options.damping ?? SPRING_DEFAULTS.damping
  const restV = options.restVelocity ?? SPRING_DEFAULTS.restVelocity
  const restD = options.restDistance ?? SPRING_DEFAULTS.restDistance

  const total = Math.min(Math.max(deltaMs, 0), 64) / 1000
  const steps = Math.max(1, Math.ceil(total / 0.008))
  const dt = total / steps

  for (let i = 0; i < steps; i++) {
    const accel = -k * (state.position - state.target) - c * state.velocity
    state.velocity += accel * dt
    state.position += state.velocity * dt
  }

  if (
    Math.abs(state.position - state.target) < restD &&
    Math.abs(state.velocity) < restV
  ) {
    state.position = state.target
    state.velocity = 0
    return false
  }
  return true
}

/** 抛出去的初速度换算：把手指速度（单位/毫秒）接到弹簧上（单位/秒） */
export function velocityFromGesture(perMillisecond: number): number {
  return perMillisecond * 1000
}

/**
 * 松手吸附（§3 / §8）。
 *
 * 速度够大 → 顺着速度方向跨一档；否则吸附到最近的一档。
 * 返回值是**目标位置**，不是"最终状态"，动画交给上面那条弹簧。
 */
export function resolveSnap(
  position: number,
  velocityPerMs: number,
  snaps: readonly number[],
  flingVelocity = 0.55
): number {
  const sorted = [...snaps].sort((a, b) => a - b)
  const first = sorted[0] ?? position
  const last = sorted[sorted.length - 1] ?? position

  if (velocityPerMs > flingVelocity) {
    // 向下甩（数值变大）= 去更小的一档
    const smaller = [...sorted].reverse().find((value) => value < position - 0.5)
    return smaller ?? first
  }
  if (velocityPerMs < -flingVelocity) {
    const larger = sorted.find((value) => value > position + 0.5)
    return larger ?? last
  }
  let nearest = sorted[0] ?? position
  let best = Infinity
  for (const value of sorted) {
    const distance = Math.abs(value - position)
    if (distance < best) {
      best = distance
      nearest = value
    }
  }
  return nearest
}
