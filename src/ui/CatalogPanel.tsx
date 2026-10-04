import { OrbitTelemetry } from './OrbitTelemetry'
import { useOrbitStatus } from '../astronomy/liveOrbits'
import { CATEGORY_FILTERS, categoryLabel } from '../data/filters'
import { useMemo, useState } from 'react'
import { OBJECTS } from '../data/objects'
import { useAtlasStore } from '../state/atlasStore'
import { useT, usePick } from '../i18n'
import { getCatalogStats } from '../scene/EarthCatalog'
import { audio } from '../audio/audioManager'

const CLASSES: Array<'ALL' | 'LEO' | 'MEO' | 'GEO'> = ['ALL', 'LEO', 'MEO', 'GEO']

/**
 * 在轨目录（v7 §6 / §7）。
 *
 * 旧版点了"在轨目录"只是把地球轨道上的 15994 个点一起点亮——用户看到的
 * 是一堆发光小点，没有任何信息。这一版给的是一份**真正的目录面板**：
 *
 *   1. 总量 / 来源 / 快照时间 / 尺度说明（讲清楚那些点到底是什么）；
 *   2. 轨道类别筛选（LEO / MEO / GEO）——选的这一类提亮，其余压暗；
 *   3. 「已建档任务」列表：CelesTrak 那份数据里只有轨道要素、没有名字，
 *      所以真正可读的信息来自仓库自己那 133 份档案，可搜索、可点击聚焦。
 */
export function CatalogPanel() {
  const t = useT()
  const pickText = usePick()
  const open = useAtlasStore((state) => state.catalogPanelOpen)
  const closePanel = useAtlasStore((state) => state.openCatalogPanel)
  const toggleCatalog = useAtlasStore((state) => state.toggleCatalog)
  const catalogVisible = useAtlasStore((state) => state.catalogVisible)
  const catalogClass = useAtlasStore((state) => state.catalogClass)
  const setCatalogClass = useAtlasStore((state) => state.setCatalogClass)
  const select = useAtlasStore((state) => state.select)
  const language = useAtlasStore((state) => state.language)
  const [query, setQuery] = useState('')
  const category = useAtlasStore(s => s.objectCategory)
  const setCategory = useAtlasStore(s => s.setObjectCategory)
  const [limit, setLimit] = useState(40)

  useOrbitStatus()
  const stats = getCatalogStats()
  const earthObjects = useMemo(() => {
    const raw = query.trim().toLowerCase()
    return OBJECTS.filter((object) => {
      if (!(CATEGORY_FILTERS.find(f=>f.id===category)?.match(object) ?? true)) return false
      if (!raw) return true
      return (
        object.name.toLowerCase().includes(raw) ||
        object.nameCn.includes(query.trim()) ||
        object.operator.en.toLowerCase().includes(raw)
      )
    })
      .sort((a, b) => (a.importance ?? 3) - (b.importance ?? 3))

  }, [query, category])

  if (!open) return null

  return (
    <aside className="catalogpanel">
      <div className="archive__top">
        <div>
          <div className="archive__id">
            {language === 'zh' ? '任务图鉴 / MISSION INDEX' : 'MISSION INDEX'}
          </div>
          <h2 className="archive__name">{OBJECTS.length}</h2>
          <div className="archive__type">{language === 'zh' ? '可检索任务档案' : 'SEARCHABLE MISSION ARCHIVES'}</div>
        </div>
        <button
          type="button"
          className="archive__close"
          onPointerEnter={() => audio.emit('object.hover')}
          onClick={() => {
            audio.emit('menu.close')
            closePanel(false)
            if (catalogVisible) toggleCatalog()
          }}
        >
          关闭 ✕
        </button>
      </div>

      <p className="archive__body">{language === 'zh' ? `任务档案与轨道快照分别统计。下方轨道图层包含 ${stats?.count.toLocaleString() ?? '—'} 条轨道记录，不等于同等数量的完整任务档案。` : 'Mission archives and orbital samples are counted separately. Current positions are propagated from dated public orbital elements, not live telemetry.'}</p>
      <OrbitTelemetry />
      {stats ? (
        <dl className="archive__rows">
          <div className="archive__row">
            <dt>SOURCE</dt>
            <dd>{stats.sourceName}</dd>
          </div>
          <div className="archive__row">
            <dt>FETCHED</dt>
            <dd>{stats.generatedAt?.slice(0, 10)}</dd>
          </div>
          <div className="archive__row">
            <dt>{t('catalog.scale')}</dt>
            <dd>{stats.scaleNote}</dd>
          </div>
        </dl>
      ) : null}

      <div className="catalogpanel__chips">
        {CLASSES.map((cls) => {
          const count = cls === 'ALL' ? stats?.count : stats?.orbitCounts?.[cls]
          return (
            <button
              key={cls}
              type="button"
              className="catalogpanel__chip"
              aria-pressed={catalogClass === cls}
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                audio.emit('button.click')
                setCatalogClass(cls)
              }}
            >
              {cls === 'ALL' ? pickText({ zh: '全部', en: 'ALL' }) : cls}
              {count ? <em>{count.toLocaleString('en-US')}</em> : null}
            </button>
          )
        })}
      </div>

      <div className="catalogpanel__tabs" aria-label="任务分类">
        {CATEGORY_FILTERS.map(f=><button key={f.id} aria-pressed={category===f.id} onClick={()=>{setCategory(f.id);useAtlasStore.getState().setFilter(f.id);setLimit(40)}}>{categoryLabel(f.id,language)} · {OBJECTS.filter(f.match).length}</button>)}
      </div>
      <div className="archive__section">
        <div className="archive__label">
          {pickText({ zh: '已建档任务', en: 'CATALOGUED MISSIONS' })}
        </div>
        <input
          className="catalogpanel__search"
          value={query}
          placeholder={t('catalog.search')}
          aria-label={language === 'zh' ? '搜索所有任务' : 'Search all missions'}
          onChange={(event) => {setQuery(event.target.value);setLimit(40)}}
        />
        <div className="archive__list">
          {earthObjects.slice(0,limit).map((object) => (
            <button
              key={object.id}
              type="button"
              className="archive__listitem"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                audio.emit('object.focus')
                /**
                 * 顺序很重要（用户 2026-09-25）：先聚焦、后收起列表。
                 *
                 * select() 会把"当前这一屏"压进聚焦历史；如果先收起列表再聚焦，
                 * 压进去的就是"列表已关闭"的状态，于是关闭详情时回到的是一个
                 * 没有列表的空图谱——这正是"关闭不是返回上一级选择对象"的根因。
                 * 反过来写，历史里存的是"任务图鉴开着"，关闭详情自然回到列表。
                 */
                select(object.id)
                closePanel(false)
              }}
            >
              <span>
                {language === 'zh' ? object.nameCn : object.name}
                <em className="catalogpanel__meta">
                  {object.operator.en} · {object.orbitClass.en}
                </em>
              </span>
              <span>{object.launched.slice(0, 4)}</span>
            </button>
          ))}
          {earthObjects.length > limit && <button className="archive__listitem" onClick={()=>setLimit(n=>n+40)}>{language==='zh' ? `继续浏览 · 还有 ${earthObjects.length-limit} 项` : `Show more · ${earthObjects.length-limit} remaining`}</button>}
          {earthObjects.length === 0 ? (
            <div className="archive__body archive__body--dim">{t('search.empty')}</div>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
