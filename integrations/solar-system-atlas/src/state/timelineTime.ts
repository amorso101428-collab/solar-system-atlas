/**
 * 连续时间轴内核（V1.1 §5 / §6）。
 *
 * `timelineFloat = 1997.438` —— 场景的时间源是一个**浮点数**，
 * 不是整数年份。行星、月球、航天器、彗星读的都是它。
 *
 * 为什么要独立于 store：
 *   · 拖动期间每帧都在变，写 zustand 会让 Timeline 组件每帧重渲染；
 *   · 但 UI 上的年份文字只需要 ~30–60ms 更新一次。
 *   · 于是这里放"场景用的连续值"，store 里放"文字用的节流值"。
 *
 * 桌面鼠标拖动、深链、回放走的仍然是 atlasStore.setTimelineYear()，
 * 它会同时写这两个值——所以桌面行为一个字都没变。
 */

export const timelineTime = {
  /** 连续目标年（用户此刻要的年份，浮点） */
  target: 2026,
  /** 上一次写进 store 的年份（用来做节流） */
  published: 2026,
}

/** UI 文字的更新间隔（§6：30~60ms） */
export const TIMELINE_UI_THROTTLE_MS = 50

let lastPublish = 0

export function forceTimelineTarget(year: number): void {
  timelineTime.target = year
  timelineTime.published = year
  lastPublish = performance.now()
}

/**
 * 拖动 / 惯性 / 弹簧推动的连续赋值。
 *
 * @param year      连续年份
 * @param publish   是否允许现在就同步给 store（松手、吸附结束时传 true）
 * @returns         需要写进 store 时返回年份，否则返回 null
 */
export function pushTimelineTarget(year: number, publish: boolean): number | null {
  timelineTime.target = year
  const now = performance.now()
  if (publish || now - lastPublish >= TIMELINE_UI_THROTTLE_MS) {
    lastPublish = now
    timelineTime.published = year
    return year
  }
  return null
}
