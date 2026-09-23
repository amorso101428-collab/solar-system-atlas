import { useEffect, useRef } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import { useDeviceClass } from '../responsive/useDevice'
import { attachSheetGesture } from '../gesture/SheetGesture'
import {
  SHEET_EXPANDED_FRACTION,
  SHEET_SNAP_VALUES,
  SHEET_SNAPS,
  sheetStateAt,
} from '../gesture/BottomSheetGesture'
import { DrawerMotion } from '../motion/DrawerMotion'

/**
 * 移动端详情 Bottom Sheet 的**连续物理层**（V1.1 §7 / §8 / §9 / §10）。
 *
 * V1 里这里是"三档状态 + CSS transition"；V1.1 改成真正的连续位置：
 *
 *   sheetProgress 0.18（collapsed）→ 0.48（half）→ 0.88（expanded）
 *
 * 手指停在 0.63 也完全可以，松手之后由弹簧决定吸附到哪一档。
 * 位置写在 `--sheet-y` 上，**只改 transform**，不动 top/height，
 * 所以拖动过程没有 layout thrash；React 只在最终吸附时收到一次档位更新。
 *
 * 档案组件的 DOM 依然一行未改。
 */
export function MobileSheet() {
  const device = useDeviceClass()
  const focusKind = useAtlasStore((state) => state.focusKind)
  const focusId = useAtlasStore((state) => state.focusId)
  const selectedObjectId = useAtlasStore((state) => state.selectedObjectId)
  const archiveOpen = useAtlasStore((state) => state.archiveOpen)
  const catalogPanelOpen = useAtlasStore((state) => state.catalogPanelOpen)
  const sheetState = useAtlasStore((state) => state.sheetState)
  const motionRef = useRef<DrawerMotion | null>(null)

  const panelOpen = catalogPanelOpen || focusKind !== 'ATLAS'

  useEffect(() => {
    // 抽屉物理只服务手机：iPad 竖屏用的是上下分区 + 面板自身滚动
    if (device !== 'mobile' || !panelOpen) return
    const element = document.querySelector('.archive, .catalogpanel') as HTMLElement | null
    if (!element) return

    const viewportHeight = () => window.visualViewport?.height ?? window.innerHeight

    /** 抽屉几何：高度按 expanded 布局，位置靠 transform 下沉 */
    const syncGeometry = () => {
      element.style.setProperty(
        '--sheet-expanded-h',
        `${SHEET_EXPANDED_FRACTION * viewportHeight()}px`
      )
    }
    syncGeometry()

    const motion = new DrawerMotion({
      position: SHEET_SNAPS[useAtlasStore.getState().sheetState],
      onFrame: (position) => {
        const offset = (SHEET_EXPANDED_FRACTION - position) * viewportHeight()
        element.style.setProperty('--sheet-y', `${offset.toFixed(1)}px`)
      },
      onSettle: (position) => {
        const next = sheetStateAt(position)
        if (next !== useAtlasStore.getState().sheetState) {
          useAtlasStore.getState().setSheetState(next)
        }
      },
    })
    motionRef.current = motion

    /**
     * 入场：从 collapsed 弹到目标档（§39 要求 spring，不要 linear）。
     * 这样"打开详情"本身就是一段**可被打断**的连续运动，
     * 而不是 CSS keyframes 那种"播完才算数"的黑箱。
     */
    const target = SHEET_SNAPS[useAtlasStore.getState().sheetState]
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      motion.jumpTo(target)
    } else {
      motion.setPosition(SHEET_SNAPS.collapsed)
      motion.animateTo(target)
    }

    const detachGesture = attachSheetGesture({
      element,
      motion,
      toPosition: (pixels) => pixels / viewportHeight(),
      softMin: SHEET_SNAPS.collapsed,
      softMax: SHEET_SNAPS.expanded,
      snaps: SHEET_SNAP_VALUES,
      // 单位是"视口高度比例 / 毫秒"：0.0009 ≈ 每秒甩出 0.9 个视口高
      flingVelocity: 0.0009,
      onDragStart: () => {
        element.dataset.dragging = 'yes'
      },
      onDragEnd: () => {
        delete element.dataset.dragging
      },
    })

    const onResize = () => {
      syncGeometry()
      motion.setPosition(motion.position)
    }
    window.addEventListener('resize', onResize, { passive: true })
    window.visualViewport?.addEventListener('resize', onResize, { passive: true })

    return () => {
      detachGesture()
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
      motion.dispose()
      motionRef.current = null
    }
  }, [device, panelOpen, focusKind, focusId, selectedObjectId, archiveOpen, catalogPanelOpen])

  /** 档位被其它入口改掉时（菜单、按钮），用同一条弹簧追过去 */
  useEffect(() => {
    const motion = motionRef.current
    if (!motion || motion.holding) return
    const target = SHEET_SNAPS[sheetState]
    if (Math.abs(target - motion.position) < 0.002 && !motion.moving) return
    motion.animateTo(target)
  }, [sheetState])

  return null
}
