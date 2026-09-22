import { isTouchLayout, getLayoutMode } from '../responsive/device'
import type { DrawerMotion } from '../motion/DrawerMotion'

/**
 * Bottom Sheet 的触摸手势（V1.1 §9 / §10 / §21）。
 *
 * 这一段必须用 **touch 事件 + preventDefault**，不能用 pointer 事件：
 * pointermove 无法阻止浏览器接管滚动，而"半屏抽屉 + 内部滚动"的仲裁
 * 恰好取决于"第一下是滚动内容还是拖动抽屉"这个判断。
 *
 * 仲裁规则（§9）：
 *
 *   抽屉没展开                      → 无论向上还是向下，都拖动抽屉
 *   抽屉已展开 + 内容不在顶部        → 让内容滚（不拦）
 *   抽屉已展开 + 内容在顶部 + 向下拖  → 收起抽屉
 *   抽屉已展开 + 内容在顶部 + 向上拖  → 让内容滚（此时内容会往下走）
 *
 * 任何情况下都不给另一个 context 漏事件（§21）。
 */
export interface SheetGestureOptions {
  /** 抽屉元素本身（同时是滚动容器） */
  element: HTMLElement
  motion: DrawerMotion
  /** 位置单位换算：像素位移 → 抽屉位置单位 */
  toPosition: (deltaPixels: number) => number
  softMin: number
  softMax: number
  snaps: readonly number[]
  /** 判定"甩"的速度阈值（位置单位/毫秒） */
  flingVelocity: number
  /** 拖动开始 / 结束（用于关掉过渡、打点自检） */
  onDragStart?: () => void
  onDragEnd?: () => void
}

export function attachSheetGesture(options: SheetGestureOptions): () => void {
  // 桌面（鼠标 / 触控板）完全不挂监听：桌面端连这个分支都不会进
  if (!isTouchLayout(getLayoutMode())) return () => {}

  const { element, motion, toPosition, softMin, softMax, snaps, flingVelocity } = options
  let active = false
  let startY = 0
  let startPosition = 0
  let lastTime = 0
  let velocity = 0

  const clamp = (value: number) => Math.min(softMax, Math.max(softMin, value))

  const onTouchStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return
    const touch = event.touches[0]!
    active = false
    startY = touch.clientY
    lastTime = performance.now()
    velocity = 0
    startPosition = motion.position
  }

  const onTouchMove = (event: TouchEvent) => {
    if (event.touches.length !== 1) {
      // 第二根手指落下：交还给 pinch / pan，本轮抽屉拖动作废
      active = false
      return
    }
    const touch = event.touches[0]!
    const dy = touch.clientY - startY
    const now = performance.now()
    const dt = Math.max(now - lastTime, 1)

    if (!active) {
      if (Math.abs(dy) < 6) return
      const atExpanded = startPosition >= softMax - 0.0001
      const atTop = element.scrollTop <= 0
      if (atExpanded) {
        // 已完全展开：先把内容滚完，再接管抽屉
        if (!atTop) return
        if (dy < 0) return
      }
      active = true
      motion.begin()
      motion.setPosition(startPosition)
      options.onDragStart?.()
      startY = touch.clientY
      lastTime = now
      velocity = 0
      return
    }

    // 跟手：滚动已经被我们拦下，位置直接跟着手指走
    event.preventDefault()
    const delta = toPosition(touch.clientY - startY)
    const next = clamp(motion.position - delta)
    velocity = velocity * 0.6 + (next - motion.position) / dt * 0.4
    motion.setPosition(next)
    lastTime = now
  }

  const finish = (event: TouchEvent) => {
    if (!active) {
      active = false
      return
    }
    active = false
    void event
    options.onDragEnd?.()
    motion.release(motion.position, velocity, snaps, flingVelocity)
    velocity = 0
  }

  const cancel = () => {
    if (!active) return
    active = false
    options.onDragEnd?.()
    motion.release(motion.position, velocity, snaps, flingVelocity)
    velocity = 0
  }

  element.addEventListener('touchstart', onTouchStart, { passive: true })
  element.addEventListener('touchmove', onTouchMove, { passive: false })
  element.addEventListener('touchend', finish, { passive: true })
  element.addEventListener('touchcancel', cancel, { passive: true })
  return () => {
    element.removeEventListener('touchstart', onTouchStart)
    element.removeEventListener('touchmove', onTouchMove)
    element.removeEventListener('touchend', finish)
    element.removeEventListener('touchcancel', cancel)
  }
}
