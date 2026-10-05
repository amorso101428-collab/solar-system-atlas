import { isTouchLayout, getLayoutMode } from '../responsive/device'
import type { DrawerMotion } from '../motion/DrawerMotion'

/**
 * Timeline 抽屉的触摸手势（V1.1 §2 / §3 / §4）。
 *
 * 与 Bottom Sheet 的差别只有一个：时间轴上还有一条**横向**的年份轨道，
 * 所以这里必须先判方向——
 *
 *   竖向拖动 → 抽屉（跟手 → 松手 → 弹簧 → 吸附）
 *   横向拖动 → 不动，交给原来的时间轴 scrub 逻辑
 *
 * 位置单位是**像素**（collapsed 72px / expanded clamp(0.46vh,320,520)），
 * 与方案书 §3 的 snapPoints 一致。
 */
export interface TimelineGestureOptions {
  element: HTMLElement
  motion: DrawerMotion
  snaps: () => readonly number[]
  softMin: number
  softMax: number
  onDragStart?: () => void
  onDragEnd?: () => void
}

export function attachTimelineGesture(options: TimelineGestureOptions): () => void {
  if (!isTouchLayout(getLayoutMode())) return () => {}

  const { element, motion, softMin, softMax } = options
  let active = false
  let decided = false
  let startX = 0
  let startY = 0
  let startPosition = 0
  let lastTime = 0
  let velocity = 0

  const clamp = (value: number) => Math.min(softMax, Math.max(softMin, value))

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]!
    active = false
    decided = false
    startX = touch.clientX
    startY = touch.clientY
    startPosition = motion.position
    lastTime = performance.now()
    velocity = 0
  }

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      active = false
      return
    }
    const touch = event.touches[0]!
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY

    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      decided = true
      // 横向为主 → 这是拖年份，不是拖抽屉
      if (Math.abs(dx) > Math.abs(dy)) return
      active = true
      motion.begin()
      motion.setPosition(startPosition)
      options.onDragStart?.()
      startY = touch.clientY
      lastTime = performance.now()
      velocity = 0
      return
    }
    if (!active) return

    // 竖向拖动：拦住浏览器的滚动，抽屉跟手
    event.preventDefault()
    const next = clamp(motion.position - (touch.clientY - startY))
    const now = performance.now()
    const dt = Math.max(now - lastTime, 1)
    velocity = velocity * 0.6 + (next - motion.position) / dt * 0.4
    motion.setPosition(next)
    lastTime = now
  }

  const finish = () => {
    if (!active) {
      active = false
      decided = false
      return
    }
    active = false
    decided = false
    options.onDragEnd?.()
    motion.release(motion.position, velocity, options.snaps())
    velocity = 0
  }

  element.addEventListener('touchstart', onTouchStart, { passive: true })
  element.addEventListener('touchmove', onTouchMove, { passive: false })
  element.addEventListener('touchend', finish, { passive: true })
  element.addEventListener('touchcancel', finish, { passive: true })
  return () => {
    element.removeEventListener('touchstart', onTouchStart)
    element.removeEventListener('touchmove', onTouchMove)
    element.removeEventListener('touchend', finish)
    element.removeEventListener('touchcancel', finish)
  }
}
