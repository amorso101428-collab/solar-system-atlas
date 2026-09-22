/**
 * 双指缩放 + 双指平移（方案书 §09）。
 *
 * 两个手势共用同一对触点，必须一起解：
 *   · 两指间距变化 → 缩放（scaleDelta > 1 = 张开 = 拉近）
 *   · 两指中点位移 → 平移（panDx / panDy）
 * 只做增量输出，不持有相机状态——和桌面滚轮 / 中键 dolly 走同一条通路。
 */
export interface PinchFrame {
  /** 相对上一帧的缩放倍率；1 = 没变 */
  scaleDelta: number
  /** 两指中点（屏幕坐标） */
  centroid: { x: number; y: number }
  /** 中点相对上一帧的位移（平移用） */
  panDx: number
  panDy: number
}

type Point = { x: number; y: number }

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function centroid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export class PinchZoomController {
  private lastDistance = 0
  private lastCentroid: Point = { x: 0, y: 0 }

  begin(a: Point, b: Point): void {
    this.lastDistance = Math.max(distance(a, b), 1)
    this.lastCentroid = centroid(a, b)
  }

  /**
   * 两指间距太近（< 12px）时视为无效帧：真实手指几乎并拢时，
   * 间距的比值会抖成十几个倍率，画面会瞬移。
   */
  update(a: Point, b: Point): PinchFrame | null {
    const next = distance(a, b)
    if (next < 12 || this.lastDistance < 12) {
      this.lastDistance = Math.max(next, 1)
      this.lastCentroid = centroid(a, b)
      return null
    }
    const center = centroid(a, b)
    const frame: PinchFrame = {
      scaleDelta: next / this.lastDistance,
      centroid: center,
      panDx: center.x - this.lastCentroid.x,
      panDy: center.y - this.lastCentroid.y,
    }
    this.lastDistance = next
    this.lastCentroid = center
    return frame
  }
}
