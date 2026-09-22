import { RETRIEVED_AT, SOURCES, type SourceKey } from '../data/sources'
import { useT } from '../i18n'

/**
 * 数据出处（v5 §20）。
 * 每份详情页的最底部都要有：来源名称、抓取 / 计算日期、官方链接。
 * 用户必须能在页面里直接看到，而不是去翻 README。
 */
export function DataProvenance({
  keys,
  dataset,
  extra,
}: {
  keys: SourceKey[]
  dataset?: string
  extra?: string
}) {
  const t = useT()
  return (
    <section className="provenance">
      <h4>{t('provenance.title')}</h4>
      <ul className="provenance__list">
        {keys.map((key) => (
          <li key={key}>
            <a href={SOURCES[key].url} target="_blank" rel="noreferrer">
              {SOURCES[key].name}
            </a>
            {SOURCES[key].note ? <em>{SOURCES[key].note}</em> : null}
          </li>
        ))}
      </ul>
      <div className="provenance__meta">
        <span>
          {t('provenance.retrieved')} {RETRIEVED_AT}
        </span>
        {dataset ? (
          <span>
            {t('provenance.dataset')} {dataset}
          </span>
        ) : null}
      </div>
      {extra ? <p className="provenance__extra">{extra}</p> : null}
    </section>
  )
}
