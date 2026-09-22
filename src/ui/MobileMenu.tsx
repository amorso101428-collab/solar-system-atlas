import { useEffect, useRef } from 'react'
import { audio } from '../audio/audioManager'
import { CATEGORY_FILTERS } from '../data/filters'
import { useT } from '../i18n'
import { useAtlasStore, type SceneArrangement } from '../state/atlasStore'
import { useDeviceClass } from '../responsive/useDevice'
import { gestureManager } from '../gesture'

const ARRANGEMENTS: SceneArrangement[] = ['SIDE', 'ORBIT3D', 'REAL']

/**
 * 移动端菜单（方案书 §17）。
 *
 * 桌面菜单是"从导航条上垂下来的小面板"，手机上那套会被挤成一团——
 * 这里改成从底部升起的抽屉，三段式分组：
 *
 *   视图   侧视排列 / 三维排列 / 实时全览 + 图层开关
 *   对象   全部 / NASA / ESA / 中国航天 / 探索 / 观测 / 通信 / 导航
 *   工具   在轨目录 / 搜索 / 指南 / 背景音乐 / 作者
 *
 * 每一段用的都是桌面同一批 store 动作，不存在"移动端另一套逻辑"。
 */
export function MobileMenu() {
  const device = useDeviceClass()
  const t = useT()
  const open = useAtlasStore((state) => state.mobileMenuOpen)
  const openMobileMenu = useAtlasStore((state) => state.openMobileMenu)
  const setSearchOpen = useAtlasStore((state) => state.setSearchOpen)
  const view = useAtlasStore((state) => state.view)
  const positionMode = useAtlasStore((state) => state.positionMode)
  const setSceneArrangement = useAtlasStore((state) => state.setSceneArrangement)
  const objectCategory = useAtlasStore((state) => state.objectCategory)
  const setObjectCategory = useAtlasStore((state) => state.setObjectCategory)
  const setFilter = useAtlasStore((state) => state.setFilter)
  const hideArtificial = useAtlasStore((state) => state.hideArtificial)
  const hideMoons = useAtlasStore((state) => state.hideMoons)
  const hideAllOrbits = useAtlasStore((state) => state.hideAllOrbits)
  const toggleHideArtificial = useAtlasStore((state) => state.toggleHideArtificial)
  const toggleHideMoons = useAtlasStore((state) => state.toggleHideMoons)
  const toggleHideAllOrbits = useAtlasStore((state) => state.toggleHideAllOrbits)
  const catalogPanelOpen = useAtlasStore((state) => state.catalogPanelOpen)
  const openCatalogPanel = useAtlasStore((state) => state.openCatalogPanel)
  const catalogVisible = useAtlasStore((state) => state.catalogVisible)
  const toggleCatalog = useAtlasStore((state) => state.toggleCatalog)
  const guideOpen = useAtlasStore((state) => state.guideOpen)
  const toggleGuide = useAtlasStore((state) => state.toggleGuide)
  const musicOpen = useAtlasStore((state) => state.musicPanelOpen)
  const openMusicPanel = useAtlasStore((state) => state.openMusicPanel)
  const toggleCreator = useAtlasStore((state) => state.toggleCreator)
  const sheetRef = useRef<HTMLDivElement>(null)

  const arrangement: SceneArrangement =
    positionMode === 'REAL' ? 'REAL' : view === 'SIDE' ? 'SIDE' : 'ORBIT3D'

  /** 向下拖拽关闭（§38：所有浮层都要能"拖走"） */
  useEffect(() => {
    const element = sheetRef.current
    if (!element || device === 'desktop' || !open) return
    return gestureManager.registerSheet(element, '.mobilemenu__grab', {
      onDragMove: (dy) => {
        element.style.transform = `translateY(${Math.max(dy, -24)}px)`
      },
      onDragEnd: (next, dy) => {
        element.style.transform = ''
        if (next === 'collapsed' || dy > 90) openMobileMenu(false)
      },
      getState: () => 'half',
    })
  }, [device, open, openMobileMenu])

  if (device === 'desktop' || !open) return null

  const close = () => {
    audio.emit('menu.close')
    openMobileMenu(false)
  }

  return (
    <div className="mobilemenu" ref={sheetRef}>
      <div className="mobilemenu__grab" aria-hidden>
        <i />
      </div>
      <div className="mobilemenu__head">
        <span className="mobilemenu__title">{t('mobile.menu')}</span>
        <button type="button" className="mobilemenu__close" onClick={close}>
          {t('archive.close')} ✕
        </button>
      </div>

      <div className="mobilemenu__scroll">
        <section className="mobilemenu__group">
          <h4>{t('nav.view')}</h4>
          {ARRANGEMENTS.map((kind) => (
            <button
              key={kind}
              type="button"
              className="mobilemenu__item"
              aria-pressed={arrangement === kind}
              onClick={() => {
                audio.emit('view.change')
                setSceneArrangement(kind)
                close()
              }}
            >
              <span>{t(`arrangement.${kind}` as never)}</span>
              <small>{t(`arrangement.${kind}.hint` as never)}</small>
            </button>
          ))}
          {(
            [
              ['viewmenu.hideArtificial', hideArtificial, toggleHideArtificial],
              ['viewmenu.hideMoons', hideMoons, toggleHideMoons],
              ['viewmenu.hideAllOrbits', hideAllOrbits, toggleHideAllOrbits],
            ] as const
          ).map(([key, checked, toggle]) => (
            <label className="mobilemenu__check" key={key}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  audio.emit(event.target.checked ? 'toggle.on' : 'toggle.off')
                  toggle(event.target.checked)
                }}
              />
              {t(key)}
            </label>
          ))}
        </section>

        <section className="mobilemenu__group">
          <h4>{t('nav.objects')}</h4>
          <div className="mobilemenu__chips">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                className="mobilemenu__chip"
                aria-pressed={objectCategory === filter.id}
                onClick={() => {
                  audio.emit('button.click')
                  setObjectCategory(filter.id)
                  setFilter(filter.id)
                }}
              >
                {t(`category.${filter.id}` as never) ?? filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mobilemenu__group">
          <h4>{t('mobile.tools')}</h4>
          <button
            type="button"
            className="mobilemenu__item mobilemenu__item--plain"
            aria-pressed={catalogPanelOpen || catalogVisible}
            onClick={() => {
              audio.emit('catalog.open')
              const next = !catalogPanelOpen
              openCatalogPanel(next)
              if (next !== catalogVisible) toggleCatalog()
              close()
            }}
          >
            <span>{t('catalog.on')}</span>
          </button>
          <button
            type="button"
            className="mobilemenu__item mobilemenu__item--plain"
            onClick={() => {
              close()
              audio.emit('search.open')
              setSearchOpen(true)
            }}
          >
            <span>{t('nav.search')}</span>
          </button>
          <button
            type="button"
            className="mobilemenu__item mobilemenu__item--plain"
            aria-pressed={guideOpen}
            onClick={() => {
              audio.emit('button.click')
              toggleGuide()
              close()
            }}
          >
            <span>{t('nav.guide')}</span>
          </button>
          <button
            type="button"
            className="mobilemenu__item mobilemenu__item--plain"
            aria-pressed={musicOpen}
            onClick={() => {
              audio.emit('menu.open')
              openMusicPanel(!musicOpen)
              close()
            }}
          >
            <span>{t('nav.music')}</span>
          </button>
          <button
            type="button"
            className="mobilemenu__item mobilemenu__item--plain"
            onClick={() => {
              audio.emit('button.click')
              toggleCreator(true)
              close()
            }}
          >
            <span>{t('mobile.about')}</span>
          </button>
        </section>
      </div>
    </div>
  )
}
