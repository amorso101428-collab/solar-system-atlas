import { useOrbitStatus } from '../astronomy/liveOrbits'
import { FlightDeck } from './FlightDeck'
import { BackButton } from './BackButton'
import { MusicToggle } from './MusicToggle'
import { useMemo, useState } from 'react'
import { OBJECTS, OBJECT_BY_ID } from '../data/objects'
import { PLANETS } from '../data/planets'
import { WORLDS } from '../data/worlds'
import { COMETS } from '../data/comets'
import { CATEGORY_FILTERS, categoryLabel } from '../data/filters'
import { useAtlasStore, type SceneArrangement } from '../state/atlasStore'
import { useT, usePick } from '../i18n'
import { getCatalogStats } from '../scene/EarthCatalog'
import { audio } from '../audio/audioManager'
import { useDeviceClass } from '../responsive/useDevice'

const ARRANGEMENTS: SceneArrangement[] = ['SIDE', 'ORBIT3D', 'REAL']

/** 对象菜单按语义分组（v7 §16）：先任务类别，再任务机构 */
const FILTER_GROUPS = [{ label: 'group.category', ids: CATEGORY_FILTERS.map(f => f.id) }]

/**
 * 顶部导航（v7 §2 / §15 / §16 / §17）。
 *
 * 固定三栏，互不影响：
 *   左上  主页
 *   中上  场景控制 —— 对象 · 天体 · 实时位置 · 视图
 *   右上  工具 —— 中/EN · 在轨目录 · 搜索 · 指南 · 音效 · 背景音乐
 *
 * 详情面板 / 目录面板都从导航底下开始（top: 74px），所以任何状态下
 * 导航的位置、宽度、换行都不会变——这一条是 v7 的硬性验收项。
 */
export function TopBar() {
  const t = useT()
  const pickText = usePick()
  /**
   * V1：桌面端这个值是 'desktop'，下面那枚全屏搜索的关闭键因此
   * **不会出现在 DOM 里**——桌面端连标记都与之前一致。
   */
  const device = useDeviceClass()
  const language = useAtlasStore((state) => state.language)
  const toggleLanguage = useAtlasStore((state) => state.toggleLanguage)
  const guideOpen = useAtlasStore((state) => state.guideOpen)
  const toggleGuide = useAtlasStore((state) => state.toggleGuide)
  const view = useAtlasStore((state) => state.view)
  const positionMode = useAtlasStore((state) => state.positionMode)
  const setSceneArrangement = useAtlasStore((state) => state.setSceneArrangement)
  const schematicView = useAtlasStore((state) => state.schematicView)
  const catalogVisible = useAtlasStore((state) => state.catalogVisible)
  const catalogPanelOpen = useAtlasStore((state) => state.catalogPanelOpen)
  const openCatalogPanel = useAtlasStore((state) => state.openCatalogPanel)
  const toggleCatalog = useAtlasStore((state) => state.toggleCatalog)
  const objectCategory = useAtlasStore((state) => state.objectCategory)
  const setObjectCategory = useAtlasStore((state) => state.setObjectCategory)
  const setFilter = useAtlasStore((state) => state.setFilter)
  const goHome = useAtlasStore((state) => state.goHome)
  const select = useAtlasStore((state) => state.select)
  const focusPlanet = useAtlasStore((state) => state.focusPlanet)
  const focusMoon = useAtlasStore((state) => state.focusMoon)
  const focusComet = useAtlasStore((state) => state.focusComet)
  const focusRegion = useAtlasStore((state) => state.focusRegion)
  const focusKind = useAtlasStore((state) => state.focusKind)
  const focusId = useAtlasStore((state) => state.focusId)
  const [query, setQuery] = useState('')
  /**
   * V1：搜索面板的开关搬到 store 里（原来只存在于 TopBar 的局部 state）。
   * 移动端底部动作条的 SEARCH、以及 Esc，都要能打开 / 关掉同一个面板；
   * 桌面端的按钮行为与之前完全一致。
   */
  const searchOpen = useAtlasStore((state) => state.searchOpen)
  const setSearchOpen = useAtlasStore((state) => state.setSearchOpen)
  const menu = useAtlasStore(s => s.menu)
  const objectsOpen = menu === 'objects', worldsOpen = menu === 'worlds', viewMenuOpen = menu === 'view'
  const setObjectsOpen = (value:boolean) => { if(value || useAtlasStore.getState().menu === 'objects') useAtlasStore.getState().setMenu(value ? 'objects' : null) }
  const setWorldsOpen = (value:boolean) => { if(value || useAtlasStore.getState().menu === 'worlds') useAtlasStore.getState().setMenu(value ? 'worlds' : null) }
  const setViewMenuOpen = (value:boolean) => { if(value || useAtlasStore.getState().menu === 'view') useAtlasStore.getState().setMenu(value ? 'view' : null) }
  const hideArtificial = useAtlasStore((state) => state.hideArtificial)
  const hideMoons = useAtlasStore((state) => state.hideMoons)
  const hideAllOrbits = useAtlasStore((state) => state.hideAllOrbits)
  const toggleHideArtificial = useAtlasStore((state) => state.toggleHideArtificial)
  const toggleHideMoons = useAtlasStore((state) => state.toggleHideMoons)
  const toggleHideAllOrbits = useAtlasStore((state) => state.toggleHideAllOrbits)
  const musicOpen = useAtlasStore((state) => state.musicPanelOpen)
  const openMusicPanel = useAtlasStore((state) => state.openMusicPanel)
  const toggleCreator = useAtlasStore((state) => state.toggleCreator)

  const arrangement: SceneArrangement =
    positionMode === 'REAL' ? 'REAL' : view === 'SIDE' ? 'SIDE' : 'ORBIT3D'

  /** 搜索覆盖天体 / 卫星 / 航天器 / 彗星 / 大尺度结构（v7 §23） */
  const results = useMemo(() => {
    const raw = query.trim()
    const q = raw.toLowerCase()
    if (!q) return { bodies: [], objects: [], others: [] }
    const match = (name: string, cn: string, id = '') =>
      name.toLowerCase().includes(q) || cn.includes(raw) || id.includes(q)
    const bodies = [
      ...PLANETS.map((planet) => ({
        id: planet.id,
        name: planet.name,
        cn: planet.nameCn,
        kind: 'PLANET',
        parent: 'SOLAR SYSTEM',
      })),
      ...PLANETS.flatMap((planet) =>
        planet.moons.map((moon) => ({
          id: moon.id,
          name: moon.name,
          cn: moon.nameCn,
          kind: 'MOON',
          parent: planet.name,
        }))
      ),
      ...COMETS.map((comet) => ({
        id: comet.id,
        name: comet.name,
        cn: comet.nameCn,
        kind: 'COMET',
        parent: 'SOLAR SYSTEM',
      })),
    ]
      .filter((entry) => match(entry.name, entry.cn, entry.id))
      .slice(0, 6)
    return {
      bodies,
      objects: OBJECTS.filter((object) => match(object.name, object.nameCn, object.id)).slice(0, 8),
      others: [
        { id: 'asteroid', name: 'ASTEROID BELT', cn: '小行星带' },
        { id: 'kuiper', name: 'KUIPER BELT', cn: '柯伊伯带' },
        { id: 'oort', name: 'OORT CLOUD', cn: '奥尔特云' },
      ].filter((entry) => match(entry.name, entry.cn, entry.id)),
    }
  }, [query])

  const orbitStatus = useOrbitStatus()
  const catalogCount = orbitStatus.count || undefined
  const activeCategory = CATEGORY_FILTERS.find((entry) => entry.id === objectCategory)

  const closeMenus = () => {
    setObjectsOpen(false)
    setWorldsOpen(false)
    setViewMenuOpen(false)
  }

  return (
    <div className="topbar">
      <div className="topbar__row">
        {/* ---------------- 左上：主页 ---------------- */}
        <div className="topbar__left">
          <MusicToggle />
          <button
            type="button"
            className="navbtn navbtn--home"
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              audio.emit('focus.close')
              closeMenus()
              goHome()
            }}
          >
            <span aria-hidden>⌂</span> {t('nav.home')}
          </button>
          {device !== 'mobile' && <BackButton inline />}
        </div>

        {/* ---------------- 中上：场景控制 ---------------- */}
        <div className="topbar__scene">
          <div className="navgroup">
            <button
              type="button"
              className="navbtn"
              aria-expanded={objectsOpen}
              data-open={objectsOpen ? 'yes' : 'no'}
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                const next = !objectsOpen
                closeMenus()
                setObjectsOpen(next)
                audio.emit(next ? 'menu.open' : 'menu.close')
              }}
            >
              {t('nav.objects')}
              <em>{categoryLabel(activeCategory?.id ?? 'ALL', language)}</em>
            </button>
            {objectsOpen ? (
              <div className="navmenu">
                {FILTER_GROUPS.map((group) => (
                  <div key={group.label}>
                    <div className="navmenu__group">{t(group.label as never)}</div>
                    {group.ids.map((id) => {
                      const filter = CATEGORY_FILTERS.find((entry) => entry.id === id)
                      if (!filter) return null
                      return (
                        <button
                          key={id}
                          type="button"
                          className="navmenu__item"
                          aria-pressed={objectCategory === id}
                          onPointerEnter={() => audio.emit('object.hover')}
                          onClick={() => {
                            audio.emit('button.click')
                            setObjectCategory(id)
                            setFilter(id)
                            setObjectsOpen(false)
                            // Selection applies the filter without opening another obstructing panel.
                          }}
                        >
                          {categoryLabel(id, language)}<em>{OBJECTS.filter(filter.match).length}</em>
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/**
           * 天体选择器（用户 2026-09-25）：导航条上直接列出太阳与九大行星，
           * 点一下就用 focusPlanet() 把镜头推过去——和搜索、深链是同一条路径。
           */}
          <div className="navgroup">
            <button
              type="button"
              className="navbtn"
              aria-expanded={worldsOpen}
              data-open={worldsOpen ? 'yes' : 'no'}
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                const next = !worldsOpen
                closeMenus()
                setWorldsOpen(next)
                audio.emit(next ? 'menu.open' : 'menu.close')
              }}
            >
              {t('nav.worlds')}
              <em>
                {focusKind === 'PLANET' && focusId
                  ? (WORLDS.find((entry) => entry.id === focusId)?.cn ?? focusId)
                  : t('worlds.pick')}
              </em>
            </button>
            {worldsOpen ? (
              <div className="navmenu navmenu--worlds">
                <div className="navmenu__group">{t('worlds.pick')}</div>
                <div className="worlds__grid">
                  {WORLDS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="worlds__item"
                      aria-pressed={focusKind === 'PLANET' && focusId === entry.id}
                      onPointerEnter={() => audio.emit('object.hover')}
                      onClick={() => {
                        audio.emit('object.focus')
                        focusPlanet(entry.id)
                        setWorldsOpen(false)
                      }}
                    >
                      <i style={{ background: entry.color }} aria-hidden />
                      <span>{language === 'zh' ? entry.cn : entry.en}</span>
                      <small>{entry.id === 'sun' ? t('worlds.star') : `${entry.au.toFixed(2)} AU`}</small>
                    </button>
                  ))}
                </div>
                <div className="worlds__hint">{t('worlds.hint')}</div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="navbtn"
            aria-pressed={arrangement === 'REAL'}
            // v7 §16：这个按钮是"图示 / 真实"两态开关，不是菜单，
            // 所以把说明放在 tooltip 上，而不是再塞一层菜单。
            title={t('position.hint')}
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              audio.emit('view.change')
              /**
               * 关掉实时位置时回到**打开之前**那个视图（用户 2026-09-25）：
               * 旧版一律回 SIDE，于是从三维排列点一下再关掉就被丢回侧视图。
               */
              setSceneArrangement(arrangement === 'REAL' ? schematicView : 'REAL')
            }}
          >
            {t('nav.realtime')}
            <em>{arrangement === 'REAL' ? t('position.real') : t('position.schematic')}</em>
          </button>

          <div className="navgroup">
            <button
              type="button"
              className="navbtn"
              aria-expanded={viewMenuOpen}
              data-open={viewMenuOpen ? 'yes' : 'no'}
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                const next = !viewMenuOpen
                closeMenus()
                setViewMenuOpen(next)
                audio.emit(next ? 'menu.open' : 'menu.close')
              }}
            >
              {t('nav.view')}
              <em>{t(`arrangement.${arrangement}` as never)}</em>
            </button>
            {viewMenuOpen ? (
              <div className="navmenu navmenu--wide">
                <FlightDeck onAction={closeMenus} />
                <div className="navmenu__group">{t('viewmenu.resolve')}</div>
                {ARRANGEMENTS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    className="navmenu__item navmenu__item--stack"
                    aria-pressed={arrangement === kind}
                    onPointerEnter={() => audio.emit('object.hover')}
                    onClick={() => {
                      audio.emit('view.change')
                      setSceneArrangement(kind)
                      setViewMenuOpen(false)
                    }}
                  >
                    <span>{t(`arrangement.${kind}` as never)}</span>
                    <small>{t(`arrangement.${kind}.hint` as never)}</small>
                  </button>
                ))}
                <div className="navmenu__rule" />
                <div className="navmenu__group">{t('viewmenu.layers')}</div>
                {(
                  [
                    ['viewmenu.hideArtificial', hideArtificial, toggleHideArtificial],
                    ['viewmenu.hideMoons', hideMoons, toggleHideMoons],
                    ['viewmenu.hideAllOrbits', hideAllOrbits, toggleHideAllOrbits],
                  ] as const
                ).map(([key, checked, toggle]) => (
                  <label className="navmenu__check" key={key}>
                    <span>{t(key)}</span>
                    <input
                      type="checkbox" role="switch"
                      checked={checked}
                      onChange={(event) => {
                        audio.emit(event.target.checked ? 'toggle.on' : 'toggle.off')
                        toggle(event.target.checked)
                      }}
                    />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* ---------------- 右上：工具 ---------------- */}
        <div className="topbar__utility">
          <button
            type="button"
            className="navbtn"
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              audio.emit('button.click')
              toggleLanguage()
            }}
            title="EN / 中文"
          >
            {language === 'zh' ? '中 / EN' : 'EN / 中'}
          </button>
          <button
            type="button"
            className="navbtn"
            aria-pressed={catalogPanelOpen || catalogVisible}
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              audio.emit('catalog.open')
              closeMenus()
              const next = !catalogPanelOpen
              openCatalogPanel(next)
              // catalogVisible 是"场景里要不要画那 15994 个点"，面板开关是另一件事：
              // 打开面板时同时点亮图层，关闭面板时把图层也收回去（v7 §6）
              if (next !== catalogVisible) toggleCatalog()
            }}
          >
            {t('catalog.on')}
            {catalogCount ? ` ${catalogCount.toLocaleString('en-US')}` : ''}
          </button>
          <button
            type="button"
            className="navbtn"
            aria-pressed={searchOpen}
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              const next = !searchOpen
              closeMenus()
              setSearchOpen(next)
              audio.emit(next ? 'search.open' : 'menu.close')
            }}
          >
            {t('nav.search')}
          </button>
          <button
            type="button"
            className="navbtn"
            aria-pressed={guideOpen}
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              audio.emit('button.click')
              toggleGuide()
            }}
          >
            {t('nav.guide')}
          </button>
          {/* v9 §8：作者署名入口 */}
          <button
            type="button"
            className="navbtn"
            title="关于作者 · 氕氘氚"
            onPointerEnter={() => audio.emit('object.hover')}
            onClick={() => {
              audio.emit('button.click')
              closeMenus()
              toggleCreator(true)
            }}
          >
            作者
          </button>
          <div className="navgroup">
            <button
              type="button"
              className="navbtn"
              aria-expanded={musicOpen}
              data-open={musicOpen ? 'yes' : 'no'}
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                const next = !musicOpen
                closeMenus()
                openMusicPanel(next)
                audio.emit(next ? 'menu.open' : 'menu.close')
              }}
            >
              {t('nav.music')}
            </button>
          </div>
        </div>
      </div>

      {searchOpen ? (
        <div className="searchpanel">
          {device !== 'desktop' ? (
            <button
              type="button"
              className="searchpanel__close"
              aria-label={t('archive.close')}
              onClick={() => {
                audio.emit('menu.close')
                setSearchOpen(false)
                setQuery('')
              }}
            >
              ✕
            </button>
          ) : null}
          <input
            autoFocus
            value={query}
            placeholder={t('search.placeholder')}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                const body = results.bodies[0]
                const object = results.objects[0]
                const region = results.others[0]
                if (body) {
                  audio.emit('object.focus')
                  if (body.kind === 'PLANET') focusPlanet(body.id)
                  else if (body.kind === 'MOON') focusMoon(body.id)
                  else focusComet(body.id)
                } else if (object) {
                  audio.emit('object.focus')
                  select(object.id)
                } else if (region) {
                  audio.emit('object.focus')
                  focusRegion(region.id as 'asteroid' | 'kuiper' | 'oort')
                }
                setSearchOpen(false)
                setQuery('')
              }
              if (event.key === 'Escape') setSearchOpen(false)
            }}
          />
          <div className="searchpanel__meta">{t('search.enter')}</div>
          {query &&
          results.bodies.length === 0 &&
          results.objects.length === 0 &&
          results.others.length === 0 ? (
            <div className="searchpanel__empty">{t('search.empty')}</div>
          ) : null}
          {results.bodies.map((entry) => (
            <button
              key={`${entry.kind}:${entry.id}`}
              type="button"
              className="searchpanel__item"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                audio.emit('object.focus')
                if (entry.kind === 'PLANET') focusPlanet(entry.id)
                else if (entry.kind === 'MOON') focusMoon(entry.id)
                else focusComet(entry.id)
                setSearchOpen(false)
                setQuery('')
              }}
            >
              <span>
                <em>{entry.kind}</em> {language === 'zh' ? entry.cn : entry.name}
              </span>
              <span>{entry.parent}</span>
            </button>
          ))}
          {results.objects.map((object) => (
            <button
              key={object.id}
              type="button"
              className="searchpanel__item"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                audio.emit('object.focus')
                select(object.id)
                setSearchOpen(false)
                setQuery('')
              }}
            >
              <span>
                <em>{object.category.replace('_', ' ')}</em>{' '}
                {language === 'zh' ? object.nameCn : object.name}
              </span>
              <span>{object.launched.slice(0, 4)}</span>
            </button>
          ))}
          {results.others.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="searchpanel__item"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                audio.emit('object.focus')
                focusRegion(entry.id as 'asteroid' | 'kuiper' | 'oort')
                setSearchOpen(false)
                setQuery('')
              }}
            >
              <span>
                <em>REGION</em> {language === 'zh' ? entry.cn : entry.name}
              </span>
              <span>SOLAR SYSTEM</span>
            </button>
          ))}
        </div>
      ) : null}

      {guideOpen ? (
        <div className="guide">
          <button className="guide__close" type="button" onClick={() => toggleGuide(false)} aria-label={t('archive.close')}>{t('archive.close')} ✕</button>
          <h4>{t('guide.title')}</h4>
          {device === 'mobile' ? (
            (language === 'zh' ? [
              ['单指拖动', '旋转视角，探索天体与轨道'],
              ['双指捏合', '拉近或推远镜头'],
              ['双指平移', '移动观察位置'],
              ['轻点天体', '聚焦天体并打开档案'],
              ['滑动正文', '阅读档案；横向滑动目录切换章节'],
              ['关闭档案', '点右上角关闭，或向下拖动档案标题栏'],
              ['菜单 / 搜索', '通过顶部菜单和底部搜索寻找任务'],
            ] : [
              ['Drag', 'Rotate the view to explore bodies and orbits'],
              ['Pinch', 'Zoom in or out with two fingers'],
              ['Two-finger pan', 'Move the observation position'],
              ['Tap a body', 'Focus it and open its record'],
              ['Scroll', 'Read records; swipe the contents rail sideways'],
              ['Close', 'Use the close button or drag the record header down'],
              ['Menu / Search', 'Find missions using the top menu and bottom search'],
            ]).map(([key, desc]) => (
              <div className="guide__row" key={key}>
                <span className="guide__key">{key}</span>
                <span className="guide__desc">{desc}</span>
              </div>
            ))
          ) : (
            [
              ['guide.move', 'guide.move.desc'],
              ['guide.rmb', 'guide.rmb.desc'],
              ['guide.mmb', 'guide.mmb.desc'],
              ['guide.scroll', 'guide.scroll.desc'],
              ['guide.drag', 'guide.drag.desc'],
              ['guide.click', 'guide.click.desc'],
              ['guide.esc', 'guide.esc.desc'],
            ] as const
          ).map(([key, desc]) => (
            <div className="guide__row" key={key}>
              <span className="guide__key">{t(key)}</span>
              <span className="guide__desc">{t(desc)}</span>
            </div>
          ))}
          <div className="guide__note">{pickText(OBJECT_BY_ID.get('voyager-1')?.mission)}</div>
        </div>
      ) : null}
    </div>
  )
}
