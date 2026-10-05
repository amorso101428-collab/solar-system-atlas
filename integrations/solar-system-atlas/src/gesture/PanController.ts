/**
 * 平移（方案书 §09：双指平移 = Pan）。
 *
 * 屏幕位移 → 世界位移的换算和桌面左键拖拽完全一致（按视口高度取比例），
 * 这样同一个手势在 iPad 和桌面上挪的距离是一样的。
 */
export class PanController {
  /** 把屏幕像素换算成世界单位（由视口可见高度决定） */
  toWorld(pixels: number, visibleHeight: number, viewportHeight: number): number {
    if (viewportHeight <= 0) return 0
    return (pixels * visibleHeight) / viewportHeight
  }
}
