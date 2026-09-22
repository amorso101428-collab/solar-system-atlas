import { useMemo, useState } from 'react'
import { PLANET_BY_ID } from '../data/planets'
import { OBJECTS } from '../data/objects'
import { useAtlasStore } from '../state/atlasStore'
import { useT, usePick } from '../i18n'
import { formatNumber } from '../utils/formatters'
import type { MoonDef, PlanetDef } from '../data/types'
import { BODY_FACTS, MOON_FACTS } from '../data/bodyFacts'
import { DataProvenance } from './DataProvenance'
import { BODY_LAYERS_FULL, SURFACE_FEATURES } from '../data/surfaceFeatures'
import { KNOWLEDGE } from '../data/knowledge'
import { formatNumber as fmtNum } from '../utils/formatters'

// 天体档案（方案书 §8 的同一套版式：左景右档）。
// 点行星看到的是这个系统的总览：物理参数，以及停在这里的人类造物清单。
export function BodyArchive({ kind, id }: { kind: 'PLANET' | 'MOON'; id: string }) {
  const t = useT()
  const pickText = usePick()
  const language = useAtlasStore((state) => state.language)
  const select = useAtlasStore((state) => state.select)
  const back = useAtlasStore((state) => state.back)
  const [objectQuery, setObjectQuery] = useState('')

  const planet: PlanetDef | undefined = PLANET_BY_ID.get(id as never)
  const moon: MoonDef | undefined = useMemo(
    () => [...PLANET_BY_ID.values()].flatMap((entry) => entry.moons).find((entry) => entry.id === id),
    [id]
  )

  const exists = kind === 'PLANET' ? Boolean(planet) : Boolean(moon)
  if (!exists) return null

  const systemId = kind === 'PLANET' ? id : 'moon'
  const here = OBJECTS.filter((object) => object.system === systemId)
  /**
   * 本系统的人造卫星搜索（v7 §8）：聚焦一颗行星之后，它周围可能停着几十个
   * 航天器——没有搜索就只能靠肉眼找。这里做实时过滤，点击直接聚焦。
   */
  const normalized = objectQuery.trim().toLowerCase()
  const hereFiltered = normalized
    ? here.filter(
        (object) =>
          object.name.toLowerCase().includes(normalized) ||
          object.nameCn.includes(objectQuery.trim()) ||
          object.id.includes(normalized)
      )
    : here
  const facts = kind === 'PLANET' ? BODY_FACTS[id] : MOON_FACTS[id]
  // v8 §37：球面上只放少量空间标注，完整解释在右侧档案里
  const surfaceFeatures = SURFACE_FEATURES[id] ?? []
  const bodyLayers = BODY_LAYERS_FULL[id] ?? []
  /** v9 §10–§16：深度科普档案（长文 + 时间线 + 来源） */
  const article = KNOWLEDGE[id]

  const rows: Array<[string, string]> =
    kind === 'PLANET' && planet
      ? [
          [t('body.radius'), `${formatNumber(planet.realRadiusKm)} km`],
          [t('body.diameter'), `${formatNumber(planet.realRadiusKm * 2)} km`],
          [t('body.mass'), facts?.massKg ? `${facts.massKg.toExponential(3)} kg` : '—'],
          [t('body.gravity'), facts?.gravity ? `${facts.gravity} m/s²` : '—'],
          [t('body.realDistance'), `${planet.realAu.toFixed(2)} AU`],
          [t('body.moons'), `${planet.moonCount}`],
          [t('body.rotation'), `${planet.rotationHours} h`],
          [t('body.orbitPeriod'), facts?.orbitDays ? `${formatNumber(facts.orbitDays)} d` : '—'],
          [t('body.inclination'), `${planet.elements.i.toFixed(2)}°`],
          [t('body.eccentricity'), planet.elements.e.toFixed(4)],
          [t('body.semiMajor'), `${planet.elements.a.toFixed(3)} AU`],
          [t('body.axialTilt'), `${((planet.axialTilt / Math.PI) * 180).toFixed(1)}°`],
          [t('body.meanTemp'), facts?.meanTempC !== undefined ? `${facts.meanTempC} °C` : '—'],
          [t('body.orbitEcc'), planet.orbitEcc.toFixed(3)],
          [t('body.missionCount'), `${here.length}`],
        ]
      : [
          [t('body.radius'), moon?.radiusKm ? `${formatNumber(moon.radiusKm)} km` : '—'],
          [t('body.diameter'), moon?.radiusKm ? `${formatNumber(moon.radiusKm * 2)} km` : '—'],
          [t('body.mass'), facts?.massKg ? `${facts.massKg.toExponential(3)} kg` : '—'],
          [t('body.gravity'), facts?.gravity ? `${facts.gravity} m/s²` : '—'],
          [t('body.orbitPeriod'), facts?.orbitDays ? `${facts.orbitDays} d` : '—'],
          [t('body.distance'), moon ? moon.orbitRadius.toFixed(2) : '—'],
          [t('body.missionCount'), `${here.length}`],
        ]

  const bodyName = kind === 'PLANET' ? planet!.name : moon!.name
  const bodyNameCn = kind === 'PLANET' ? planet!.nameCn : moon!.nameCn
  const note = kind === 'PLANET' ? planet!.note : moon!.note

  return (
    <aside className="archive" key={id}>
      <div className="archive__top">
        <span className="archive__id">
          {t('archive.file')} · {kind} · {systemId.toUpperCase()}
        </span>
        <button type="button" className="archive__close" onClick={() => back()}>
          {t('archive.close')} ✕
        </button>
      </div>

      <h2 className="archive__name">{language === 'zh' ? bodyNameCn : bodyName}</h2>
      <div className="archive__type">{language === 'zh' ? bodyName : bodyNameCn}</div>
      <div className="archive__cn">
        {kind === 'PLANET'
          ? pickText({ zh: '行星系统', en: 'PLANETARY SYSTEM' })
          : pickText({ zh: '天然卫星', en: 'NATURAL SATELLITE' })}
      </div>

      <div className="archive__rule" />

      {/* v9 §10：详情页是"科普文章"，不是卡片——开头先给一段导语 */}
      {article ? (
        <section className="archive__section">
          <h4>{language === 'zh' ? article.headline.zh : article.headline.en}</h4>
          <p className="archive__lead">
            {language === 'zh' ? article.lead.zh : article.lead.en}
          </p>
        </section>
      ) : null}

      <dl className="archive__rows">
        {rows.map(([key, value]) => (
          <div className="archive__row" key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {note ? (
        <section className="archive__section">
          <h4>{t('body.note')}</h4>
          <p className="archive__body">{note}</p>
        </section>
      ) : null}

      {facts?.composition ? (
        <section className="archive__section">
          <h4>{t('body.composition')}</h4>
          <p className="archive__body">{pickText(facts.composition)}</p>
        </section>
      ) : null}

      {facts?.atmosphere ? (
        <section className="archive__section">
          <h4>{t('body.atmosphere')}</h4>
          <p className="archive__body">{pickText(facts.atmosphere)}</p>
        </section>
      ) : null}

      {facts?.discovery || facts?.exploration ? (
        <section className="archive__section">
          <h4>{t('body.exploration')}</h4>
          {facts.discovery ? (
            <p className="archive__body">
              <em>{t('body.discovery')}</em> {pickText(facts.discovery)}
            </p>
          ) : null}
          {facts.exploration ? <p className="archive__body">{pickText(facts.exploration)}</p> : null}
        </section>
      ) : null}

      {/* v9 §11：长文分节，默认只展开第一节（progressive disclosure） */}
      {article ? (
        <section className="archive__section">
          <h4>{pickText({ zh: '深度档案', en: 'LONG-FORM ARCHIVE' })}</h4>
          <div className="archive__article">
            {article.sections.map((section, index) => (
              <details key={section.id} open={index === 0}>
                <summary>
                  <span>{language === 'zh' ? section.title.zh : section.title.en}</span>
                  <em>{String(index + 1).padStart(2, '0')}</em>
                </summary>
                <p>{language === 'zh' ? section.body.zh : section.body.en}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {article?.timeline?.length ? (
        <section className="archive__section">
          <h4>{pickText({ zh: '任务时间线', en: 'MISSION TIMELINE' })}</h4>
          <ol className="archive__timeline">
            {article.timeline.map((event) => (
              <li key={`${event.date}-${event.text.en}`}>
                <b>{event.date}</b>
                <span>{language === 'zh' ? event.text.zh : event.text.en}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {facts?.extra?.length ? (
        <section className="archive__section">
          <h4>{t('archive.profile')}</h4>
          <dl className="archive__rows">
            {facts.extra.map((entry) => (
              <div className="archive__row" key={entry.value}>
                <dt>{pickText(entry.label)}</dt>
                <dd>{entry.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* v8 §29–§36：球面上的标注在这里给出完整解释 */}
      {surfaceFeatures.length > 0 ? (
        <section className="archive__section">
          <h4>{pickText({ zh: '地貌标注', en: 'SURFACE FEATURES' })}</h4>
          <ul className="archive__features">
            {surfaceFeatures.map((feature) => (
              <li key={feature.id}>
                <b>{language === 'zh' ? feature.nameCn : feature.name}</b>
                <span>{language === 'zh' ? feature.meta.zh : feature.meta.en}</span>
                <em>
                  {feature.lat.toFixed(1)}°{feature.lat >= 0 ? 'N' : 'S'} /{' '}
                  {Math.abs(feature.lon).toFixed(1)}°{feature.lon >= 0 ? 'E' : 'W'}
                </em>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {bodyLayers.length > 0 ? (
        <section className="archive__section">
          <h4>{pickText({ zh: '分层与结构', en: 'LAYERS AND STRUCTURE' })}</h4>
          <dl className="archive__rows">
            {bodyLayers.map((layer) => (
              <div className="archive__row" key={layer.id}>
                <dt>{language === 'zh' ? layer.nameCn : layer.name}</dt>
                <dd>{layer.range}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="archive__section">
        <h4>{t('body.missionCount')}</h4>
        <input
          className="archive__search"
          value={objectQuery}
          placeholder={t('archive.searchObjects')}
          onChange={(event) => setObjectQuery(event.target.value)}
        />
        <div className="archive__list">
          {hereFiltered.map((object) => (
            <button
              key={object.id}
              type="button"
              className="archive__listitem"
              onClick={() => select(object.id)}
            >
              <span>{language === 'zh' ? object.nameCn : object.name}</span>
              <span>{object.launched.slice(0, 4)}</span>
            </button>
          ))}
          {hereFiltered.length === 0 ? <div className="archive__body">—</div> : null}
        </div>
      </section>

      <DataProvenance
        keys={kind === 'PLANET' ? ['nasa', 'horizons', 'spice', 'sss'] : ['nasa', 'usgs', 'spice']}
        dataset={kind === 'PLANET' ? 'NASA Planetary Fact Sheet · IAU 2015' : 'USGS / JPL 全球图'}
      />

      {/* v9 §11：来源清单（每条都给出官方链接） */}
      {article?.sources?.length ? (
        <section className="archive__section">
          <h4>{pickText({ zh: '资料来源', en: 'SOURCE ARCHIVE' })}</h4>
          <ul className="archive__sources">
            {article.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  )
}
