import { isTouchLayout, getLayoutMode } from '../responsive/device'
import { SHEET_ORDER, type SheetState } from './BottomSheetGesture'
import { PinchZoomController } from './PinchZoomController'
import { TouchOrbitController } from './TouchOrbitController'

/**
 * 统一手势分发（方案书 §08 / §11）。
 *
 * 规则只有一条：**每个组件都不许自己监听 touchmove**。
 * 谁需要手势，就把自己的元素和 context 注册进来，由这里统一识别后分发：
 *
 *   canvas   → 单指旋转 / 双指缩放 / 双指平移 / 单击
 *   detail   → 纵向滚动（交给浏览器，这里只负责不被 canvas 抢走）
 *   timeline → 横向拖动（含惯性，见 Timeline.tsx）
 *   sheet    → 纵向拖拽吸附
 *   menu     → 与 sheet 同规则
 *
 * 关键约束：**鼠标事件一律不经过这里**（`pointerType === 'mouse'` 直接返回），
 * 所以桌面端的指针逻辑与 V1 之前完全一样，是同一份代码。
 */

export type GestureContext = 'canvas' | 'detail' | 'timeline' | 'sheet' | 'menu'

export interface CanvasGestureHandlers {
  /** 单指开始拖动（用来触发"侧视 → 3D 展开"这类一次性状态切换） */
  onOrbitStart?: () => void
  /** 单指旋转增量（弧度） */
  onOrbit?: (yaw: number, pitch: number) => void
  /** 双指平移增量（屏幕像素） */
  onPan?: (dx: number, dy: number) => void
  /** 双指缩放增量（scaleDelta > 1 = 拉近） */
  onPinch?: (scaleDelta: number) => void
  /** 手势结束（手指全部离开） */
  onEnd?: () => void
  /** 轻点（未超过拖动阈值）——选中 / 聚焦由 R3F 的 click 负责，这里只做提示 */
  onTap?: (x: number, y: number) => void
}

/** 只有"手指"才算手势；鼠标 / 触控板指针完全走原路径 */
function isTouchPointer(event: PointerEvent): boolean {
  return event.pointerType !== 'mouse'
}

interface CanvasRegistration {
  element: HTMLElement
  handlers: CanvasGestureHandlers
}

class GestureManagerImpl {
  private orbit = new TouchOrbitController()
  private pinch = new PinchZoomController()
  private pointers = new Map<number, { x: number; y: number }>()
  private mode: 'none' | 'orbit' | 'pinch' = 'none'
  private startTime = 0
  private registration: CanvasRegistration | null = null
  private detach: (() => void) | null = null

  /**
   * 注册 canvas 手势区。
   *
   * 桌面端（含鼠标的触屏笔记本）在这里直接返回空函数：连监听器都不挂，
   * 从根上保证桌面零变化。
   */
  registerCanvas(element: HTMLElement, handlers: CanvasGestureHandlers): () => void {
    if (!isTouchLayout(getLayoutMode())) return () => {}
    // 只允许一个 canvas 注册（同一时刻舞台上只有一个 3D 画布）
    this.detach?.()
    this.registration = { element, handlers }

    const onPointerDown = (event: PointerEvent) => {
      if (!isTouchPointer(event)) return
      if (this.pointers.size >= 2) return
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      element.setPointerCapture?.(event.pointerId)

      if (this.pointers.size === 1) {
        this.mode = 'orbit'
        this.startTime = performance.now()
        this.orbit.begin(event.clientX, event.clientY)
        handlers.onOrbitStart?.()
      } else {
        // 双指落下：旋转让位给缩放 / 平移
        this.mode = 'pinch'
        const [a, b] = [...this.pointers.values()]
        if (a && b) this.pinch.begin(a, b)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      const tracked = this.pointers.get(event.pointerId)
      if (!tracked) return
      tracked.x = event.clientX
      tracked.y = event.clientY

      if (this.mode === 'orbit' && this.pointers.size === 1) {
        const delta = this.orbit.move(event.clientX, event.clientY)
        if (delta) handlers.onOrbit?.(delta.yaw, delta.pitch)
        return
      }
      if (this.mode === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()]
        if (!a || !b) return
        const frame = this.pinch.update(a, b)
        if (!frame) return
        if (Math.abs(frame.scaleDelta - 1) > 0.002) handlers.onPinch?.(frame.scaleDelta)
        if (Math.abs(frame.panDx) + Math.abs(frame.panDy) > 0.4) {
          handlers.onPan?.(frame.panDx, frame.panDy)
        }
      }
    }

    const finish = (event: PointerEvent) => {
      if (!this.pointers.has(event.pointerId)) return
      this.pointers.delete(event.pointerId)
      element.releasePointerCapture?.(event.pointerId)

      if (this.pointers.size === 1) {
        // 双指里抬起一根：剩下的那根不要"跳"，重新以它为新起点继续旋转
        const [rest] = [...this.pointers.values()]
        if (rest) {
          this.mode = 'orbit'
          this.orbit.begin(rest.x, rest.y)
        }
        return
      }

      if (this.pointers.size === 0) {
        const quick = performance.now() - this.startTime < 420
        const still = this.orbit.distance < this.orbit.dragThreshold
        if (this.mode === 'orbit' && quick && still) {
          handlers.onTap?.(event.clientX, event.clientY)
        }
        this.mode = 'none'
        handlers.onEnd?.()
      }
    }

    const onPointerCancel = (event: PointerEvent) => finish(event)

    element.addEventListener('pointerdown', onPointerDown)
    // move / up 挂在 window 上：手指滑出画布也要继续跟随
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', onPointerCancel)

    this.detach = () => {
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', onPointerCancel)
      this.pointers.clear()
      this.mode = 'none'
      this.registration = null
    }
    return this.detach
  }

  /**
   * 注册纵向拖拽吸附（菜单抽屉用）。
   * 只有落在 `handleSelector` 命中的区域里才开始拖拽——面板正文照常滚动。
   *
   * Bottom Sheet 自身已经不用这一条了（V1.1 §7 起走 DrawerMotion 的连续物理），
   * 这里保留给"拖走即关闭"的简单浮层，行为与 V1 一致。
   */
  registerSheet(
    element: HTMLElement,
    handleSelector: string,
    handlers: {
      onDragStart?: () => void
      onDragMove?: (dy: number) => void
      onDragEnd?: (next: SheetState, dy: number) => void
      getState: () => SheetState
    }
  ): () => void {
    if (!isTouchLayout(getLayoutMode())) return () => {}
    let active = false
    let total = 0
    let startY = 0
    let lastY = 0
    let lastTime = 0
    let velocity = 0

    const onPointerDown = (event: PointerEvent) => {
      if (!isTouchPointer(event)) return
      const target = event.target as HTMLElement | null
      if (!target?.closest(handleSelector)) return
      active = true
      total = 0
      startY = event.clientY
      lastY = startY
      lastTime = performance.now()
      velocity = 0
      handlers.onDragStart?.()
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!active) return
      const now = performance.now()
      const dt = Math.max(now - lastTime, 1)
      velocity = velocity * 0.6 + ((event.clientY - lastY) / dt) * 0.4
      lastY = event.clientY
      lastTime = now
      total = event.clientY - startY
      handlers.onDragMove?.(total)
    }

    const onPointerUp = () => {
      if (!active) return
      active = false
      const state = handlers.getState()
      const index = SHEET_ORDER.indexOf(state)
      let next = state
      if (velocity > 0.55) next = SHEET_ORDER[Math.max(0, index - 1)] ?? state
      else if (velocity < -0.55) next = SHEET_ORDER[Math.min(SHEET_ORDER.length - 1, index + 1)] ?? state
      else if (total > 90) next = SHEET_ORDER[Math.max(0, index - 1)] ?? state
      else if (total < -90) next = SHEET_ORDER[Math.min(SHEET_ORDER.length - 1, index + 1)] ?? state
      handlers.onDragEnd?.(next, total)
      velocity = 0
    }

    element.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    return () => {
      element.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
    }
  }

  /** 自检用：当前识别到的手势 */
  debugInfo(): Record<string, unknown> {
    return {
      mode: this.mode,
      pointers: this.pointers.size,
      registered: Boolean(this.registration),
      layout: getLayoutMode(),
    }
  }
}

export const gestureManager = new GestureManagerImpl()
