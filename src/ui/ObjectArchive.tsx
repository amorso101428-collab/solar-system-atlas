import { useState } from 'react'
import { OBJECT_BY_ID } from '../data/objects'
import { useAtlasStore } from '../state/atlasStore'
import { DataProvenance } from './DataProvenance'
import { useT, usePick } from '../i18n'
import { distanceRatio, formatDate, missionYears } from '../utils/formatters'
import { AVAILABLE_IMAGES } from '../data/images.available'

const KIND_LABEL: Record<string, { zh: string; en: string }> = {
  satellite: { zh: '人造卫星', en: 'ARTIFICIAL SATELLITE' },
  station: { zh: '载人空间站', en: 'HUMAN HABITAT' },
  telescope: { zh: '空间望远镜', en: 'SPACE TELESCOPE' },
  orbiter: { zh: '行星轨道器', en: 'PLANETARY ORBITER' },
  lander: { zh: '着陆器', en: 'LANDER' },
  rover: { zh: '巡视器', en: 'SURFACE ROVER' },
  probe: { zh: '深空探测器', en: 'DEEP SPACE PROBE' },
  capsule: { zh: '载人飞船', en: 'CREWED CAPSULE' },
  constellation: { zh: '导航星座', en: 'NAVIGATION CONSTELLATION' },
}

/** 稳定不变的档案编号：由 id 推出来，不写死在 JSX 里 */
function fileNumber(id: string): string {
  let h = 7
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return String(h).padStart(3, '0')
}

/**
 * 航天器档案（方案书 §8）。
 *
 * 版式是硬性的：左边 55~60% 留给空间场景，右边是这一栏 editorial panel。
 * 内容按"标题 → 副标题 → 关键数据 → 任务始末 → 关键节点 → 影像"的顺序
 * 逐层进入，每层 60~120ms，形成阅读节奏，而不是一眼看完一整张卡片。
 */
export function ObjectArchive({ objectId }: { objectId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const back = useAtlasStore((state) => state.back)
  const language = useAtlasStore((state) => state.language)
  const t = useT()
  const pickText = usePick()
  const object = OBJECT_BY_ID.get(objectId)
  if (!object) return null

  const kind = KIND_LABEL[object.kind] ?? { zh: object.kind, en: object.kind }
  const keyRows: Array<[string, string | undefined]> = [
    [t('archive.status'), `● ${t(`status.${object.status}` as 'status.ACTIVE')}`],
    [t('archive.launched'), formatDate(object.launched)],
    [t('archive.age'), `${missionYears(object.launched)} ${t('archive.years')}`],
    [t('archive.operator'), pickText(object.operator)],
  ]
  const fullRows: Array<[string, string | undefined]> = [
    [t('archive.orbit'), pickText(object.orbitClass)],
    [t('archive.mass'), object.specs.mass],
    [t('archive.power'), object.specs.power],
    [t('archive.velocity'), object.specs.velocity],
    [t('archive.dimensions'), object.specs.dimensions],
    [t('archive.vehicle'), object.specs.launchVehicle],
    [t('archive.period'), object.specs.orbitPeriod],
    [t('archive.distance'), pickText(object.distanceLabel)],
  ]

  return (
    <aside className="archive" key={object.id}>
      <div className="archive__top">
        <span className="archive__id">
          {t('archive.file')} {fileNumber(object.id)} · {object.category}
        </span>
        <button type="button" className="archive__close" onClick={back}>
          {t('archive.close')} ✕
        </button>
      </div>

      <h2 className="archive__name">{language === 'zh' ? object.nameCn : object.name}</h2>
      <div className="archive__type">{language === 'zh' ? kind.zh : kind.en}</div>
      <div className="archive__cn">
        {language === 'zh' ? object.name : object.nameCn} · {pickText(object.mission)}
      </div>

      <div className="archive__rule" />

      <dl className="archive__rows archive__rows--key">
        {keyRows
          .filter(([, value]) => Boolean(value))
          .map(([key, value]) => (
            <div className="archive__row" key={key}>
              <dt>{key}</dt>
              <dd style={key === t('archive.status') ? { color: 'var(--node)' } : undefined}>{value}</dd>
            </div>
          ))}
      </dl>

      <section className="archive__section">
        <h4>{t('archive.missionStory')}</h4>
        <p className="archive__body">{pickText(object.summary)}</p>
        {object.why.en !== object.summary.en ? (
          <p className="archive__body archive__body--dim">{pickText(object.why)}</p>
        ) : null}
      </section>

      <section className="archive__section">
        <h4>{t('archive.keyEvents')}</h4>
        <ol className="archive__timeline">
          {object.timeline.map((event) => (
            <li key={`${event.date}-${event.text.en}`}>
              <b>{event.date.slice(0, 4)}</b>
              <span>{pickText(event.text)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="archive__section">
        <h4>{t('archive.distance')}</h4>
        <div className="scale">
          <div className="scale__track" />
          <div className="scale__fill" style={{ width: `${distanceRatio(object.distanceAu) * 100}%` }} />
          <div className="scale__marker" style={{ left: `${distanceRatio(object.distanceAu) * 100}%` }} />
        </div>
        <div className="scale__labels">
          <span>1 AU</span>
          <span>{pickText(object.distanceLabel)}</span>
          <span>180 AU</span>
        </div>
      </section>

      {!imageFailed && AVAILABLE_IMAGES.has(object.id) ? (
        <figure className="archive__image" style={{ margin: 0 }}>
          <img
            src={`/images/objects/${object.id}.jpg`}
            alt={object.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
          <figcaption className="archive__caption">
            NASA / ESA / JAXA / CNSA · {t('archive.sources')}
          </figcaption>
        </figure>
      ) : null}

      <button type="button" className="archive__expand" onClick={() => setExpanded((value) => !value)}>
        {expanded ? t('archive.collapse') : t('archive.expand')} {expanded ? '−' : '+'}
      </button>

      <div className={`archive__full${expanded ? ' is-open' : ''}`}>
        <section className="archive__section">
          <h4>{t('archive.profile')}</h4>
          <dl className="archive__rows">
            {fullRows
              .filter(([, value]) => Boolean(value))
              .map(([key, value]) => (
                <div className="archive__row" key={key}>
                  <dt>{key}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
          </dl>
          {object.specs.instruments?.length ? (
            <div className="archive__chips">
              {object.specs.instruments.map((instrument) => (
                <span key={instrument}>{instrument}</span>
              ))}
            </div>
          ) : null}
        </section>

        <section className="archive__section">
          <h4>{t('archive.sources')}</h4>
          <div className="archive__sources">
            {object.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">
                {source.title} ↗
              </a>
            ))}
          </div>
        </section>
        <DataProvenance keys={['mission', 'celestrak', 'nasa']} dataset="NASA/ESA 任务档案 · CelesTrak" />
      </div>
    </aside>
  )
}
