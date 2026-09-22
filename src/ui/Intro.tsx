import { useEffect, useState } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import { useT } from '../i18n'
import { CharacterRevealText } from './CharacterRevealText'
import { audio } from '../audio/audioManager'
import { HomeQuote } from './QuoteTicker'
import { CreatorLine } from './CreatorCard'

/**
 * 开场（方案书 §1）。
 *
 * 最重要的规则：**Intro 是视觉层，不是 Loading 层。**
 *   · 1.05s 起 ENTER ATLAS 就可用，绝不等到动画播完
 *   · 右下角始终保留 SKIP
 *   · 背景是真实的三维宇宙（见 scene/IntroCosmos.tsx），不是 CSS 椭圆加一个飞走的圆点
 */
const INTRO_INTERACTIVE_AT = 1050
const INTRO_AUTO_END = 2900

/**
 * 自检用：`?intro=hold` 不让开场自动结束，方便截稳定的主页图。
 * 和 `?boot=hold`、`?debug=1` 一样，只在开发/自检时使用。
 */
const INTRO_HOLD =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('intro') === 'hold'

export function Intro() {
  const mode = useAtlasStore((state) => state.mode)
  const enterAtlas = useAtlasStore((state) => state.enterAtlas)
  const [stage, setStage] = useState(0)
  const [ready, setReady] = useState(false)
  const t = useT()

  useEffect(() => {
    if (mode !== 'INTRO') return
    const timers = [
      window.setTimeout(() => setReady(true), INTRO_INTERACTIVE_AT),
      window.setTimeout(() => setStage(1), 420),
      window.setTimeout(() => setStage(2), 1500),
      INTRO_HOLD ? 0 : window.setTimeout(() => setStage(3), INTRO_AUTO_END),
    ]
    return () => timers.forEach(window.clearTimeout)
  }, [mode])

  // 进入图谱的 1.4s 里仍然保留在 DOM 上（相机同时从内太阳系推出去），
  // 让开场是"淡出"而不是"被抽走"（v7 §9）
  if (mode !== 'INTRO' && mode !== 'ENTERING') return null

  return (
    <div
      className="intro"
      data-stage={stage}
      data-ready={ready ? 'yes' : 'no'}
      // v7 §9：进入图谱时主页不是"被抽走"，而是整体 dissolve —— 与相机推进同步
      data-leaving={mode === 'ENTERING' ? 'yes' : 'no'}
    >
      <div className="intro__scrim" />

      <div className="intro__inner">
        <div className="intro__edition">{t('intro.edition')}</div>
        <h1 className="intro__title">
          <CharacterRevealText text="HUMAN ARTIFACTS" startAt={0.34} stagger={0.036} />
        </h1>
        <div className="intro__rule" />
        <p className="intro__sub">
          <CharacterRevealText text={t('brand.sub1')} startAt={0.72} stagger={0.014} tick={26} />
          <br />
          <CharacterRevealText text={t('brand.sub2')} startAt={0.86} stagger={0.014} tick={26} />
        </p>
        <p className="intro__cn">{t('intro.line')}</p>

        {/* v9 §19：主页也要有"天文学思想长廊" */}
        <HomeQuote />

        <button
          type="button"
          className="intro__cta"
          onPointerEnter={() => audio.emit('object.hover')}
          onClick={() => {
            audio.emit('enter.atlas')
            enterAtlas()
          }}
          tabIndex={ready ? 0 : -1}
        >
          <span>{t('intro.enter')}</span>
          <i />
        </button>
        <div className="intro__hint">{t('intro.hint')}</div>
        {/* v9 §34：主页署名一行（不抢主视觉，但必须存在） */}
        <CreatorLine />
      </div>

      {/* v9 §20 / §35：横向扫描线已全部删除（未来复古不靠 CRT 扫描线表达） */}
      <div className="intro__telemetry">
        <span className="intro__pulse" />
        {t('intro.loading')}
      </div>
      <ul className="intro__status" aria-hidden>
        <li>[ SYSTEM READY ]</li>
        <li>EPHEMERIS // 2026</li>
        <li>OBJECT INDEX // ONLINE</li>
        <li>ORBITAL DATA // READY</li>
      </ul>

      <button
        type="button"
        className="intro__skip"
        onPointerEnter={() => audio.emit('object.hover')}
        onClick={() => {
          audio.emit('button.click')
          enterAtlas(true)
        }}
      >
        {t('intro.skip')} →
      </button>
    </div>
  )
}
