import { useAtlasStore } from '../state/atlasStore'
import { useT } from '../i18n'
import { OBJECT_BY_ID } from '../data/objects'
import { PLANETS, PLANET_BY_ID } from '../data/planets'
import { requestOrbitPose } from '../utils/orbitPose'
import { usePick } from '../i18n'
import { audio } from '../audio/audioManager'

const MOON_PARENT = new Map(PLANETS.flatMap((planet) => planet.moons.map((moon) => [moon.id, planet])))

/**
 * 层级返回（方案书 §7.3 / §23）。
 *
 * 不放大按钮、不做面包屑图标，只用一行字说清楚"退回哪一层"：
 *   ← SOLAR SYSTEM / ← EARTH SYSTEM / ← EARTH ORBIT / BACK TO ATLAS
 */
export function BackButton() {
  const focusKind = useAtlasStore((state) => state.focusKind)
  const focusId = useAtlasStore((state) => state.focusId)
  const atlasPose = useAtlasStore((state) => state.atlasPose)
  const view = useAtlasStore((state) => state.view)
  const back = useAtlasStore((state) => state.back)
  const setAtlasPose = useAtlasStore((state) => state.setAtlasPose)
  const setView = useAtlasStore((state) => state.setView)
  const t = useT()
  const pickText = usePick()

  let label: string | null = null
  if (focusKind === 'OBJECT' && focusId) {
    const object = OBJECT_BY_ID.get(focusId)
    const system = object?.system
    if (system === 'moon') label = t('back.moon')
    else if (system && PLANET_BY_ID.has(system as never)) {
      const planet = PLANET_BY_ID.get(system as never)!
      label = `← ${pickText({ zh: `${planet.nameCn}系统`, en: `${planet.name} SYSTEM` })}`
    } else label = t('back.system')
  } else if (focusKind === 'MOON' && focusId) {
    const parent = MOON_PARENT.get(focusId)
    label = parent
      ? `← ${pickText({ zh: `${parent.nameCn}系统`, en: `${parent.name} SYSTEM` })}`
      : t('back.earth')
  } else if (focusKind === 'PLANET') {
    label = t('back.system')
  } else if (focusKind === 'REGION') {
    label = t('back.region')
  } else if (view === 'ORBIT3D' || !atlasPose) {
    // 已经在 3D 里，但没有聚焦任何东西：给一个明确的"回到侧视图"
    label = t('back.side')
  }

  if (!label) return null

  return (
    <button
      type="button"
      className="backbtn"
      onPointerEnter={() => audio.emit('object.hover')}
      onClick={() => {
        audio.emit('focus.close')
        if (focusKind === 'ATLAS') {
          setView('SIDE')
          requestOrbitPose(0, performance.now() / 1000)
          setAtlasPose(true)
          return
        }
        back()
      }}
    >
      <i />
      {label}
    </button>
  )
}

/**
 * 轨道展开 HUD（方案书 §3.2）。
 * 右键开始转动视角时，这里显示"轨道面正在散开"的进度与说明——
 * 让那次把平面图谱变成真实 3D 的姿态变化，成为一段被看见的动画。
 */
export function UnfoldHud() {
  const t = useT()
  const unfoldLevel = useAtlasStore((state) => state.unfoldLevel)
  const atlasPose = useAtlasStore((state) => state.atlasPose)
  const visible = !atlasPose || unfoldLevel > 0.01

  return (
    <div className="unfold" data-open={visible ? 'yes' : 'no'} data-done={unfoldLevel > 0.98 ? 'yes' : 'no'}>
      <div className="unfold__head">
        <span className="unfold__title">{t('unfold.title')}</span>
        <span className="unfold__value">{Math.round(unfoldLevel * 100)}%</span>
      </div>
      <div className="unfold__bar">
        <i style={{ width: `${Math.round(unfoldLevel * 100)}%` }} />
      </div>
      <div className="unfold__desc">{unfoldLevel > 0.98 ? t('unfold.done') : t('unfold.desc')}</div>
    </div>
  )
}
