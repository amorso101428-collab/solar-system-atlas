import { COMET_BY_ID } from '../data/comets'
import { useAtlasStore } from '../state/atlasStore'
import { useT, usePick } from '../i18n'
import { cometSunDistance } from '../astronomy/cometOrbit'
import { DataProvenance } from './DataProvenance'

/**
 * 彗星档案（v5 §14 / §19）。
 * 轨道要素全部是真实的：半长轴、偏心率、倾角、近日点 / 远日点、周期。
 */
export function CometArchive({ id }: { id: string }) {
  const t = useT()
  const pickText = usePick()
  const language = useAtlasStore((state) => state.language)
  const timelineYear = useAtlasStore((state) => state.timelineYear)
  const back = useAtlasStore((state) => state.back)

  const comet = COMET_BY_ID.get(id)
  if (!comet) return null

  const distanceNow = cometSunDistance(comet, timelineYear)

  const rows: Array<[string, string]> = [
    [t('body.semiMajor'), `${comet.a.toFixed(3)} AU`],
    [t('body.eccentricity'), comet.e.toFixed(5)],
    [t('body.inclination'), `${comet.i.toFixed(2)}°`],
    [t('comet.perihelion'), `${comet.perihelionAu.toFixed(3)} AU`],
    [t('comet.aphelion'), `${comet.aphelionAu.toFixed(2)} AU`],
    [t('body.orbitPeriod'), `${comet.periodYears} ${t('archive.years')}`],
    [t('comet.nucleus'), `≈ ${comet.nucleusKm} km`],
    [t('comet.distanceNow'), `${distanceNow.toFixed(3)} AU`],
  ]

  return (
    <aside className="archive" key={id}>
      <div className="archive__top">
        <span className="archive__id">
          {t('archive.file')} · COMET · {comet.name.split('/')[0]}
        </span>
        <button type="button" className="archive__close" onClick={() => back()}>
          {t('archive.close')} ✕
        </button>
      </div>

      <h2 className="archive__name">{language === 'zh' ? comet.nameCn : comet.name}</h2>
      <div className="archive__type">{language === 'zh' ? comet.name : comet.nameCn}</div>
      <div className="archive__cn">{pickText({ zh: '彗星', en: 'COMET' })}</div>

      <div className="archive__rule" />

      <dl className="archive__rows">
        {rows.map(([key, value]) => (
          <div className="archive__row" key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="archive__section">
        <h4>{t('region.note')}</h4>
        <p className="archive__body">{pickText(comet.note)}</p>
      </section>

      {comet.mission ? (
        <section className="archive__section">
          <h4>{t('body.exploration')}</h4>
          <p className="archive__body">{pickText(comet.mission)}</p>
        </section>
      ) : null}

      <section className="archive__section">
        <h4>{t('archive.sources')}</h4>
        <div className="archive__sources">
          {comet.sources.map((source) => (
            <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">
              {source.title} ↗
            </a>
          ))}
        </div>
      </section>

      <DataProvenance keys={['horizons', 'nasa']} dataset="JPL Small-Body Database" />
    </aside>
  )
}
