import { resolveSnap, stepSpring, velocityFromGesture, type SpringState } from './spring'

/**
 * 抽屉的连续物理（V1.1 §3 / §4 / §8）。
 *
 * Timeline 与 Bottom Sheet 共用这一个对象：
 *
 *   position  —— 当前几何位置（单位随调用方：sheet 用"占视口高度的比例"，timeline 用 px）
 *   velocity  —— 手指速度（单位/秒）
 *   target    —— 吸附目标
 *
 * 手指按下时 `setPosition()` 由触摸事件**直接**写入（不经过 React），
 * 松手时 `release()` 把速度交给弹簧，rAF 逐帧推到目标位置。
 * 全程只调用 `onFrame(position)`，由调用方写 CSS 变量——没有一帧 React 重渲染。
 */
export interface DrawerMotionOptions {
  /** 初始位置 */
  position: number
  /** 每一帧回调（写 CSS 变量 / transform 用） */
  onFrame: (position: number) => void
  /** 停稳时回调一次（写 store 里的档位、发出确认音等） */
  onSettle?: (position: number) => void
  /** 可选：弹簧参数覆盖 */
  stiffness?: number
  damping?: number
}

export class DrawerMotion {
  readonly state: SpringState
  private options: DrawerMotionOptions
  private raf: number | null = null
  private lastFrame = 0
  /** 手指是否正按着（按着的时候弹簧不许抢位置） */
  private held = false

  constructor(options: DrawerMotionOptions) {
    this.options = options
    this.state = { position: options.position, velocity: 0, target: options.position }
    this.apply(options.position)
  }

  get position(): number {
    return this.state.position
  }

  get moving(): boolean {
    return this.raf !== null
  }

  get holding(): boolean {
    return this.held
  }

  /** 手指按下 */
  begin(): void {
    this.held = true
    this.stopLoop()
    this.state.velocity = 0
  }

  /** 跟手：直接落位（不夹值，夹值交给调用方） */
  setPosition(position: number): void {
    this.state.position = position
    this.apply(position)
  }

  /**
   * 松手：把手指速度（单位/毫秒）接进弹簧，并吸附到目标。
   *
   * flingVelocity 的**单位必须和 position 一致**：
   *   · Bottom Sheet 用"视口高度比例"，所以是 ~0.0009 /ms
   *   · Timeline 用像素，所以是 ~0.55 px/ms
   */
  release(
    position: number,
    velocityPerMs: number,
    snaps: readonly number[],
    flingVelocity?: number
  ): void {
    this.held = false
    this.state.position = position
    this.state.velocity = velocityFromGesture(velocityPerMs)
    this.state.target = resolveSnap(position, velocityPerMs, snaps, flingVelocity)
    this.startLoop()
  }

  /** 直接吸附到某个目标（点击展开 / 程序化收起） */
  animateTo(target: number, velocity = 0): void {
    this.held = false
    this.state.target = target
    this.state.velocity = velocity
    this.startLoop()
  }

  /** 立即落位（初始化、切换焦点时用） */
  jumpTo(position: number): void {
    this.stopLoop()
    this.held = false
    this.state.position = position
    this.state.velocity = 0
    this.state.target = position
    this.apply(position)
    this.options.onSettle?.(position)
  }

  dispose(): void {
    this.stopLoop()
  }

  private apply(position: number): void {
    this.options.onFrame(position)
  }

  private stopLoop(): void {
    if (this.raf !== null) {
      cancelAnimationFrame(this.raf)
      this.raf = null
    }
  }

  private startLoop(): void {
    if (this.raf !== null) return
    this.lastFrame = performance.now()
    const tick = (now: number) => {
      const dt = now - this.lastFrame
      this.lastFrame = now
      const alive = stepSpring(this.state, dt, {
        stiffness: this.options.stiffness,
        damping: this.options.damping,
      })
      this.apply(this.state.position)
      if (!alive) {
        this.raf = null
        this.options.onSettle?.(this.state.position)
        return
      }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }
}
