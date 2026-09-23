import { audio } from '../audio/audioManager'
import { useT } from '../i18n'
import { useAtlasStore } from '../state/atlasStore'
import { useDeviceClass } from '../responsive/useDevice'

/**
 * 移动端导航（方案书 §16）。
 *
 * 手机顶部不再摆完整的桌面导航，只留三件事：
 *
 *     ┌───────────────────────┐
 *     │ HOME              ☰ EN│
 *     └───────────────────────┘
 *
 * 底部再固定两个核心动作：VIEW（打开菜单抽屉）/ SEARCH（全屏搜索）。
 * 时间轴仍然是底部那条细线，夹在动作条上方（见 responsive.css）。
 *
 * 桌面端直接返回 null —— 这一段 DOM 在桌面上根本不存在。
 */
export function MobileNav() {
  const device = useDeviceClass()
  const t = useT()
  const language = useAtlasStore((state) => state.language)
  const toggleLanguage = useAtlasStore((state) => state.toggleLanguage)
  const goHome = useAtlasStore((state) => state.goHome)
  const mobileMenuOpen = useAtlasStore((state) => state.mobileMenuOpen)
  const openMobileMenu = useAtlasStore((state) => state.openMobileMenu)
  const setSearchOpen = useAtlasStore((state) => state.setSearchOpen)

  /**
   * V1.1 真机修复：这一层**只给手机**。
   *
   * 之前 iPad 也渲染它，于是平板顶部同时出现两套导航：
   * 平板顶栏（对象 / 实时位置 / 视图 / 中 EN / 目录 / 搜索 …）
   * 和这条移动条（主页 / 菜单 / EN），两者在右上角直接压字
   * —— 真机截图里的"右上角 UI 重叠"。
   * iPad 本来就有完整的顶部导航，底部动作条也不需要。
   */
  if (device !== 'mobile') return null

  return (
    <>
      <div className="mobilebar">
        <button
          type="button"
          className="mobilebar__btn mobilebar__btn--home"
          onClick={() => {
            audio.emit('focus.close')
            openMobileMenu(false)
            setSearchOpen(false)
            goHome()
          }}
        >
          <span aria-hidden>⌂</span> {t('nav.home')}
        </button>

        <div className="mobilebar__right">
          <button
            type="button"
            className="mobilebar__btn"
            aria-expanded={mobileMenuOpen}
            onClick={() => {
              const next = !mobileMenuOpen
              audio.emit(next ? 'menu.open' : 'menu.close')
              openMobileMenu(next)
            }}
          >
            <span aria-hidden>☰</span> {t('mobile.menu')}
          </button>
          <button
            type="button"
            className="mobilebar__btn mobilebar__btn--lang"
            title="EN / 中文"
            onClick={() => {
              audio.emit('button.click')
              toggleLanguage()
            }}
          >
            {language === 'zh' ? 'EN' : '中'}
          </button>
        </div>
      </div>

      <div className="mobiledock">
        <button
          type="button"
          className="mobiledock__btn"
          aria-expanded={mobileMenuOpen}
          onClick={() => {
            audio.emit('menu.open')
            openMobileMenu(true)
          }}
        >
          {t('nav.view')}
        </button>
        <button
          type="button"
          className="mobiledock__btn"
          onClick={() => {
            audio.emit('search.open')
            openMobileMenu(false)
            setSearchOpen(true)
          }}
        >
          {t('nav.search')}
        </button>
      </div>
    </>
  )
}
