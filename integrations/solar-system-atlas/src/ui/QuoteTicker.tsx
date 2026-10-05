import { useEffect, useState } from 'react'
import { quoteAt, type QuoteEntry } from '../data/quotes'
import { useAtlasStore } from '../state/atlasStore'

/**
 * Astronomical Voices / 天文学思想长廊（v9 §5–§8）。
 *
 * 两个版式，同一份数据：
 *   HomeQuote  —— 主页：位于标题以下、进入按钮以上，很慢地淡入淡出
 *   AtlasQuote —— 图谱：左下角的编辑栏，停 4–6.5 秒换一条
 *
 * 动效按 §8：当前语录字距略张开、透明度下降（550ms 退出），
 * 下一条 clip-reveal 进来（850ms），作者随后出现；停止时间 4~6.5 秒。
 * 不跑马灯、不复制文字堆、不发光——文字必须保持锐利。
 */
const EXIT_MS = 550
const ENTER_MS = 850
const REST_MS = 5200

function useQuoteCycle(rest = REST_MS) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'rest' | 'exit' | 'enter'>('enter')

  useEffect(() => {
    if (phase === 'enter') {
      const timer = window.setTimeout(() => setPhase('rest'), ENTER_MS)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'rest') {
      const timer = window.setTimeout(() => setPhase('exit'), rest)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => {
      setIndex((value) => value + 1)
      setPhase('enter')
    }, EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [phase, rest])

  return { quote: quoteAt(index), phase }
}

const STATUS_LABEL: Record<QuoteEntry['attributionStatus'], { zh: string; en: string }> = {
  verified: { zh: '出处明确', en: 'VERIFIED SOURCE' },
  attributed: { zh: '广泛引用', en: 'ATTRIBUTED' },
  disputed: { zh: '归属存疑', en: 'ATTRIBUTION UNCERTAIN' },
}

/** 主页版：标题以下、进入按钮以上 */
export function HomeQuote() {
  const { quote, phase } = useQuoteCycle(6000)
  const language = useAtlasStore((state) => state.language)
  const status = STATUS_LABEL[quote.attributionStatus]

  return (
    <figure className="homequote" data-phase={phase}>
      <blockquote>{language === 'zh' ? quote.quoteZh : quote.quote}</blockquote>
      <figcaption>
        <span className="homequote__author">
          — {language === 'zh' ? quote.personZh : quote.person}
          {quote.year ? ` · ${quote.year}` : ''}
        </span>
        <span className="homequote__status" data-status={quote.attributionStatus}>
          {language === 'zh' ? status.zh : status.en}
        </span>
        {quote.attributionStatus !== 'verified' ? (
          <a className="homequote__source" href={quote.sourceUrl} target="_blank" rel="noreferrer">
            出处
          </a>
        ) : null}
      </figcaption>
    </figure>
  )
}

/** 图谱版：左下编辑栏 */
export function AtlasQuote() {
  const { quote, phase } = useQuoteCycle()
  const language = useAtlasStore((state) => state.language)
  const focusKind = useAtlasStore((state) => state.focusKind)
  // 聚焦某个天体时让位给详情阅读，不在旁边晃
  const hidden = focusKind !== 'ATLAS'
  const status = STATUS_LABEL[quote.attributionStatus]

  return (
    <aside className="quote-rail" data-phase={phase} data-hidden={hidden ? 'yes' : 'no'}>
      <div className="quote-rail__label">ASTRONOMICAL VOICES · 天文学思想长廊</div>
      <blockquote>{language === 'zh' ? quote.quoteZh : quote.quote}</blockquote>
      <div className="quote-rail__meta">
        <span>
          — {language === 'zh' ? quote.personZh : quote.person}
          {quote.year ? ` · ${quote.year}` : ''}
        </span>
        <span data-status={quote.attributionStatus}>
          {language === 'zh' ? status.zh : status.en}
        </span>
      </div>
    </aside>
  )
}
