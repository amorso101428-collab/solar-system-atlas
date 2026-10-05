/**
 * Bottom Sheet 的**几何与档位**（V1 §06 / V1.1 §7 / §8）。
 *
 * 这里不再有任何"拖拽状态机"：位置的连续变化在 `motion/DrawerMotion.ts`，
 * 本文件只回答两个问题：
 *   1. 三档吸附点分别是视口高度的百分之多少
 *   2. 某个连续位置，应该被读成哪一档（UI 文案、CSS 属性用）
 *
 * 数值与方案书 §8 一致：snapPoints = [0.18, 0.48, 0.88]。
 */

export type SheetState = 'collapsed' | 'half' | 'expanded'

export const SHEET_ORDER: SheetState[] = ['collapsed', 'half', 'expanded']

/** 三档吸附点：占视口高度的比例（§8） */
export const SHEET_SNAPS: Record<SheetState, number> = {
  /** 只有标题条露出来，天体完全在画面里（§06 的那张示意图） */
  collapsed: 0.18,
  half: 0.48,
  expanded: 0.88,
}

export const SHEET_SNAP_VALUES: number[] = SHEET_ORDER.map((state) => SHEET_SNAPS[state])

/** 展开态的几何高度：抽屉元素本身按这个高度布局，靠 transform 下沉到各档 */
export const SHEET_EXPANDED_FRACTION = SHEET_SNAPS.expanded

/** 把连续位置读成档位（最近的一档，只用于文案 / 属性，不参与动画） */
export function sheetStateAt(position: number): SheetState {
  let best: SheetState = 'collapsed'
  let distance = Infinity
  for (const state of SHEET_ORDER) {
    const candidate = Math.abs(SHEET_SNAPS[state] - position)
    if (candidate < distance) {
      distance = candidate
      best = state
    }
  }
  return best
}

/** 兼容旧引用：某个档位的位置 */
export const SHEET_RATIO = SHEET_SNAPS
