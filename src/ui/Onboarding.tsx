import { useEffect, useState } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import { useT } from '../i18n'
import { audio } from '../audio/audioManager'

const STORAGE_KEY = 'atlas.onboarding.v6'
/** 自动收起（毫秒）：它是提示，不是弹窗，看完就该消失 */
const AUTO_DISMISS = 12000

/**
 * 新手引导（v6 §11）：Interactive Museum Guide，不是 SaaS Tour。
 *
 * 第一次落到侧视图时，左下角浮出一只小手 + 三行极简说明：
 *   左键拖动 · 平移图谱 / 右键拖动 · 展开真实轨道倾角 / 滚轮 · 缩放尺度
 *
 * 规矩：
 *   · 只出现一次（localStorage 记住）；
 *   · 12 秒自动淡出，用户一开始拖动也立刻收起；
 *   · 没有任何遮罩、不锁交互、不抢画面——1px 边框 + 低对比文字。
 */
export function Onboarding() {
  const t = useT()
  const mode = useAtlasStore((state) => state.mode)
  const dismiss = useAtlasStore((state) => state.dismissOnboarding)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (mode !== 'ATLAS') return
    if (window.localStorage.getItem(STORAGE_KEY) === 'done') {
      dismiss()
      return
    }
    setVisible(true)
    audio.emit('onboarding.appear')
    const timer = window.setTimeout(() => {
      setVisible(false)
      window.localStorage.setItem(STORAGE_KEY, 'done')
      dismiss()
    }, AUTO_DISMISS)
    return () => window.clearTimeout(timer)
  }, [mode, dismiss])

  // 用户一旦自己开始操作（左键平移 / 右键转视角），提示立刻退场
  useEffect(() => {
    if (!visible) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.button !== 2) return
      setVisible(false)
      window.localStorage.setItem(STORAGE_KEY, 'done')
      dismiss()
    }
    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [visible, dismiss])

  return (
    <div className="onboard" data-visible={visible ? 'yes' : 'no'} aria-hidden={!visible}>
      <div className="onboard__hand" aria-hidden>
        {/* 一只极简的手：手掌 + 食指，左右轻移模拟拖动 */}
        <svg viewBox="0 0 24 32" width="20" height="26">
          <path
            d="M8 14V6.5a1.6 1.6 0 0 1 3.2 0V13h1V9.4a1.5 1.5 0 0 1 3 0V13h1v-2.6a1.5 1.5 0 0 1 3 0V13h.4a3.4 3.4 0 0 1 3.4 3.4v4.2c0 4.2-2.7 7.4-6.9 7.4h-3.5c-3.4 0-5.2-1.8-7-5.1l-1.7-3.1c-.6-1.1-.2-2.3 .8-2.9 1-.5 2.2-.2 2.9.7L8 14Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="onboard__body">
        <span className="onboard__title">拖动 · 进入三维</span>
        <span className="onboard__line">{t('onboard.drag')}</span>
        <span className="onboard__line">{t('onboard.orbit')}</span>
        <span className="onboard__line">{t('onboard.zoom')}</span>
      </div>
      <button
        type="button"
        className="onboard__close"
        onPointerEnter={() => audio.emit('object.hover')}
        onClick={() => {
          audio.emit('onboarding.dismiss')
          setVisible(false)
          window.localStorage.setItem(STORAGE_KEY, 'done')
          dismiss()
        }}
      >
        {t('onboard.dismiss')}
      </button>
    </div>
  )
}
