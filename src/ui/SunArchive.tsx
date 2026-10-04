import { BodyObservation } from './BodyObservation'
import { ArchiveContents } from './ArchiveContents'
import { useExperience } from '../state/experience'
import { KnowledgeReader } from './KnowledgeReader'
import { OBJECTS } from '../data/objects'
import { SUN } from '../data/planets'
import { useAtlasStore } from '../state/atlasStore'
import { useT, usePick } from '../i18n'
import { formatNumber } from '../utils/formatters'
import { DataProvenance } from './DataProvenance'

/**
 * 太阳档案（v5 §17）。
 * 太阳是唯一被聚焦的恒星：左景右档、可旋转可缩放，数据与其他天体同等详细。
 */
export function SunArchive() {
  const t = useT()
  const pickText = usePick()
  const language = useAtlasStore((state) => state.language)
  const back = useAtlasStore((state) => state.back)
  const select = useAtlasStore((state) => state.select)
  const spaceWeatherOpen = useAtlasStore((state) => state.spaceWeatherOpen)
  const toggleSpaceWeather = useAtlasStore((state) => state.toggleSpaceWeather)

  const spectrum = useExperience(s=>s.sunSpectrum)
  const here = OBJECTS.filter((object) => object.system === 'sun')

  const rows: Array<[string, string]> = [
    [t('body.radius'), `${formatNumber(696000)} km`],
    [t('body.diameter'), `${formatNumber(1392000)} km`],
    [t('sun.mass'), '1.989 × 10³⁰ kg（占太阳系 99.86%）'],
    [t('sun.composition'), pickText({ zh: '氢 73% · 氦 25% · 其他 2%', en: 'H 73% · He 25% · others 2%' })],
    [t('sun.temperature'), '5,772 K（光球）'],
    [t('sun.core'), '约 1.57 × 10⁷ K'],
    [t('body.axialTilt'), '7.25°（相对黄道）'],
    [t('sun.rotation'), '25.05 天'],
    [t('sun.activity'), '约 11 年周期 · 非实时活动数据'],
  ]

  return (
    <aside className="archive" key="sun">
      <div className="archive__top">
        <span className="archive__id">{t('archive.file')} · STAR · SUN</span>
        <button type="button" className="archive__close" onClick={() => back()}>
          {t('archive.close')} ✕
        </button>
      </div>

      <h2 className="archive__name">{language === 'zh' ? SUN.nameCn : SUN.name}</h2>
      <div className="archive__type">{language === 'zh' ? SUN.name : SUN.nameCn}</div>
      <div className="archive__cn">{t('sun.type')}</div>

      <div className="archive__rule" />
      <ArchiveContents identity="sun" />
      <BodyObservation id={"sun"} />
      <div className="catalogpanel__tabs" aria-label="太阳观测波段">
        <button aria-pressed={spectrum==='halpha'} onClick={()=>useExperience.setState({sunSpectrum:'halpha'})}>{language==='zh'?'色球层 · Hα':'CHROMOSPHERE · Hα'}</button>
        <button aria-pressed={spectrum==='white'} onClick={()=>useExperience.setState({sunSpectrum:'white'})}>{language==='zh'?'光球层 · 白光':'PHOTOSPHERE · WHITE LIGHT'}</button>
      </div>
      <p className="archive__body archive__body--dim">{language==='zh'?'Hα 风格为色球层增强示意：纹理经艺术重建，日珥为三维模拟，不代表此刻太阳的实测活动。白光模式展示不同的观测层。':'Hα-inspired enhanced visualization: artistically reconstructed texture and simulated prominences, not live solar imagery. White light reveals a different observational layer.'}</p>

      <dl className="archive__rows">
        {rows.map(([key, value]) => (
          <div className="archive__row" key={key}>
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <section className="archive__section">
        <h4>{t('body.note')}</h4>
        <p className="archive__body">{SUN.note}</p>
      </section>

      <section className="archive__section">
        <h4>{t('sun.activity')}</h4>
        <p className="archive__body">
          {pickText({
            zh: '光球层的米粒组织与黑子采用程序化近似，并参考日面图像调制；色球层、日冕与日珥是独立图层。强烈的耀斑与日冕物质抛射只在开启专题图层时出现，主界面不会无意义地持续喷粒子。',
            en: 'Granulation and sunspots are procedural approximations informed by solar imagery; chromosphere, corona and prominences are separate layers. Strong flares and CMEs only appear when the dedicated layer is on — the main view never sprays particles for no reason.',
          })}
        </p>
        <button
          type="button"
          className="archive__listitem"
          onClick={() => toggleSpaceWeather(!spaceWeatherOpen)}
        >
          <span>{t('weather.title')}</span>
          <span>{spaceWeatherOpen ? 'ON' : 'OFF'}</span>
        </button>
      </section>

      <section className="archive__section">
        <h4>{t('body.missionCount')}</h4>
        <div className="archive__list">
          {here.map((object) => (
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
        </div>
      </section>

      <KnowledgeReader id="sun" />
      <DataProvenance keys={['sdo', 'nasa', 'horizons', 'spice']} dataset="SDO HMI · IAU 2015" />
    </aside>
  )
}
