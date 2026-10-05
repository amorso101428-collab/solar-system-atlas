/**
 * 单指旋转（方案书 §09：Canvas 单指拖动 = Rotate）。
 *
 * 只做一件事：把手指的屏幕位移换算成 yaw / pitch 的增量。
 * 灵敏度与桌面右键拖拽保持同一量级，手感才不会"换个设备就变一个人"。
 */
export class TouchOrbitController {
  /** 灵敏度：与桌面右键拖拽一致（yaw 0.0032 / pitch 0.0022 rad per px） */
  readonly yawPerPixel = 0.0032
  readonly pitchPerPixel = 0.0022
  /** 手指在触屏上比鼠标抖，给一个更宽的"算不算拖动"阈值 */
  readonly dragThreshold = 8

  private x = 0
  private y = 0
  private startX = 0
  private startY = 0
  private travelled = 0

  begin(x: number, y: number): void {
    this.x = x
    this.y = y
    this.startX = x
    this.startY = y
    this.travelled = 0
  }

  /**
   * 返回这一帧的旋转增量；尚未超过拖动阈值时返回 null
   * （阈值内的抖动不该让整个太阳系轻轻晃一下）。
   */
  move(x: number, y: number): { yaw: number; pitch: number } | null {
    const dx = x - this.x
    const dy = y - this.y
    this.x = x
    this.y = y
    this.travelled += Math.abs(dx) + Math.abs(dy)
    if (this.travelled < this.dragThreshold) return null
    return { yaw: -dx * this.yawPerPixel, pitch: dy * this.pitchPerPixel }
  }

  /** 手指抬起来时共走了多远（判断是"点击"还是"拖动"） */
  get distance(): number {
    return this.travelled
  }

  get origin(): { x: number; y: number } {
    return { x: this.startX, y: this.startY }
  }
}
