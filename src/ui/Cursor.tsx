import { useEffect, useRef } from 'react'
import { useAtlasStore } from '../state/atlasStore'

/**
 * 网页自定义光标（v6 §7）。
 *
 * Windows 自带的光标在这张"工程图"上很出戏，所以整套 UI 关掉系统光标
 * （见 atlas-v4.css 里的 `cursor: none !important`），改用一枚自己画的十字准线：
 *
 *   默认   细十字 + 圆环，跟随指针（带一点阻尼，像仪器上的读数头）
 *   悬停天体 / 航天器  圆环张开 34px、转成暖橙、十字收起（`data-target`）
 *   悬停 UI 控件       圆环亮一档（`data-ui`）
 *   按下              圆环收缩到 14px（`data-pressed`）
 *
 * 全部用一次 rAF + transform 更新，不触发 React 重渲染。
 */
export function Cursor() {
  const ref = useRef<HTMLDivElement>(null)
  const hoveringTarget = useAtlasStore((state) => state.hoveredId)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    let pointerX = window.innerWidth / 2
    let pointerY = window.innerHeight / 2
    let x = pointerX
    let y = pointerY
    let frame = 0

    const onMove = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      const target = event.target as HTMLElement | null
      const ui = target?.closest(
        'button, a, input, label, select, textarea, [role="button"], .timeline__track, .navmenu'
      )
      element.dataset.ui = ui ? 'yes' : 'no'
    }
    const onDown = () => {
      element.dataset.pressed = 'yes'
    }
    const onUp = () => {
      element.dataset.pressed = 'no'
    }
    const onLeave = () => {
      element.style.opacity = '0'
    }
    const onEnter = () => {
      element.style.opacity = '1'
    }

    const loop = () => {
      // 阻尼跟随：准线比指针慢一点点，画面立刻有了"仪器感"
      x += (pointerX - x) * 0.34
      y += (pointerY - y) * 0.34
      element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      frame = window.requestAnimationFrame(loop)
    }
    frame = window.requestAnimationFrame(loop)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    document.addEventListener('pointerleave', onLeave)
    document.addEventListener('pointerenter', onEnter)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerleave', onLeave)
      document.removeEventListener('pointerenter', onEnter)
    }
  }, [])

  useEffect(() => {
    const element = ref.current
    if (element) element.dataset.target = hoveringTarget ? 'yes' : 'no'
  }, [hoveringTarget])

  return (
    <div
      className="atlas-cursor"
      ref={ref}
      // 初始就摆在屏幕中央：万一指针事件还没来，也不能让用户"没有光标"
      style={{ transform: 'translate3d(50vw, 50vh, 0)' }}
      data-ui="no"
      data-target="no"
      data-pressed="no"
      aria-hidden
    >
      <i className="atlas-cursor__ring" />
      <i className="atlas-cursor__x" />
      <i className="atlas-cursor__y" />
      <i className="atlas-cursor__dot" />
    </div>
  )
}
