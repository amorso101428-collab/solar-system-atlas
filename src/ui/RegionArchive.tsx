import { useAtlasStore } from '../state/atlasStore'
import { useT } from '../i18n'
import { REGIONS } from '../utils/layout'
import { DataProvenance } from './DataProvenance'

/**
 * 小行星带 / 柯伊伯带 / 奥尔特云 的档案（方案书 §18）。
 * 它们和行星共用同一套"左景右档"版式，因为它们是同一种东西：
 * 可以被选中的天体结构，而不是背景纹理。
 */
export function RegionArchive({ id }: { id: string }) {
  const t = useT()
  const language = useAtlasStore((state) => state.language)
  const back = useAtlasStore((state) => state.back)
  const region = REGIONS.find((entry) => entry.id === id)
  if (!region) return null

  const rows: Array<[string, string]> = [
    [t('region.particles'), region.particles.toLocaleString('en-US')],
    [t('region.span'), `${Math.round((region.outer - region.inner) * 10) / 10} u`],
    [t('region.au'), auRange(region.id)],
  ]

  return (
    <aside className="archive" key={id}>
      <div className="archive__top">
        <span className="archive__id">
          {t('archive.file')} · REGION · {id.toUpperCase()}
        </span>
        <button type="button" className="archive__close" onClick={() => back()}>
          {t('archive.close')} ✕
        </button>
      </div>

      <h2 className="archive__name">{language === 'zh' ? region.nameCn : region.name}</h2>
      <div className="archive__type">{language === 'zh' ? region.name : region.nameCn}</div>
      <div className="archive__cn">{t('region.title')}</div>

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
        <p className="archive__body">{region.note}</p>
      </section>

      <DataProvenance keys={['horizons', 'nasa', 'celestrak']} dataset="JPL Horizons · CelesTrak GP" />
    </aside>
  )
}

/** 三圈结构的真实 AU 区间（只用于档案读数） */
function auRange(id: string): string {
  if (id === 'asteroid') return '2.1 – 3.3'
  if (id === 'kuiper') return '30 – 50'
  return '2 000 – 100 000'
}
