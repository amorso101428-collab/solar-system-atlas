import { useExperience } from './experience'
import { create } from 'zustand'
import type { Locale } from '../i18n'
import { parentOfObject, CURRENT_YEAR, FIRST_LAUNCH_YEAR } from '../data/objects'
import { PLANETS } from '../data/planets'
import { requestOrbitPose, requestPositionPose } from '../utils/orbitPose'
import type { SheetState } from '../gesture/BottomSheetGesture'
import { forceTimelineTarget } from './timelineTime'

/** 卫星 → 它的母星（返回上一级时用，不再写死"回地球"） */
const MOON_PARENT = new Map<string, string>(
  PLANETS.flatMap((planet) => planet.moons.map((moon) => [moon.id, planet.id]))
)

export type ViewMode = 'INTRO' | 'ENTERING' | 'ATLAS' | 'SYSTEM_FOCUS' | 'OBJECT_FOCUS'
export type CameraState = 'FREE' | 'FLYING_IN' | 'FOCUS' | 'RETURNING'
export type ViewLayer = 'ATLAS' | 'ORBITAL' | 'DEEP'

/** 聚焦层级（方案书 §15 / §23）：总览 → 行星 → 卫星 → 航天器，外加三圈大尺度结构 */
export type FocusKind = 'ATLAS' | 'PLANET' | 'MOON' | 'OBJECT' | 'REGION' | 'COMET'

/**
 * 视角状态机的顶层（方案书 §3）。
 *
 * SIDE     —— 开场那张"正对黄道面"的侧视工程图
 * ORBIT3D  —— 用户一旦开始转视角就进入这里，并且**不会自己退回去**；
 *             只有点击 SIDE VIEW / HOME 才回到侧视。
 *             之前"松开右键就弹回侧视"就是因为缺少这个状态。
 */
export type SceneView = 'SIDE' | 'ORBIT3D'

/** 行星位置模式：美术化排列 / 当前时间下的真实黄经（方案书 §16） */
export type PositionMode = 'SCHEMATIC' | 'REAL'

/**
 * 场景排列（v6 §13）：视图菜单的核心选项。
 *   SIDE    侧视排列 —— 黄道面合成一条线的信息图
 *   ORBIT3D 三维排列 —— 轨道展开成真实倾角，可环绕
 *   REAL    实时全览 —— 按当前时间轴年份的真实日心黄经摆开
 */
export type SceneArrangement = 'SIDE' | 'ORBIT3D' | 'REAL'

export type SolarUi = "detail" | "guide" | "search" | "creator" | "catalog" | "music" | "mobile" | "time" | "objects" | "worlds" | "view" | null
interface AtlasState {
  activeUi: SolarUi
  menu: "objects" | "worlds" | "view" | null
  setMenu: (menu: AtlasState["menu"]) => void
  closeUi: () => void
  mode: ViewMode
  cameraState: CameraState
  viewLayer: ViewLayer
  language: Locale
  guideOpen: boolean
  searchOpen: boolean

  focusKind: FocusKind
  focusId: string | null
  selectedObjectId: string | null
  archiveOpen: boolean

  hoveredId: string | null
  activeFilter: string
  /** 顶部 OBJECTS 分类筛选（探索类 / 观测类 / 星链 / NASA / ESA ...） */
  objectCategory: string
  timelineYear: number
  catalogVisible: boolean
  gridVisible: boolean
  spaceWeatherOpen: boolean
  /** 视图菜单（v5 §21）：三个明确的隐藏开关 + 其他卫星轨道透明度 */
  hideArtificial: boolean
  /** 隐藏**自然卫星**及其轨道（v6 §13：人造 / 自然 / 全部 三个开关） */
  hideMoons: boolean
  hidePlanetOrbits: boolean
  hideAllOrbits: boolean
  otherOrbitOpacity: number
  /** 交互音效总开关（v6 §7） */
  audioEnabled: boolean
  /** 作者面板（v9 §8） */
  creatorOpen: boolean
  /** 在轨目录面板（v7 §6）：打开的是**信息面板**，不是"把地球点亮" */
  catalogPanelOpen: boolean
  /** 背景音乐面板（v7 §20）：放在 store 里，方便深链自检与后续接入 */
  musicPanelOpen: boolean
  /** 目录里的轨道类别筛选（LEO / MEO / GEO），只影响目录图层的亮度分配 */
  catalogClass: 'ALL' | 'LEO' | 'MEO' | 'GEO'
  /** 新手引导是否已看过（v6 §11） */
  onboardingDone: boolean
  view: SceneView
  /**
   * 「退出实时位置后回到哪个视图」（用户 2026-09-25）。
   *
   * 实时位置是个开关：打开时看真实日心黄经，关掉时应该回到**打开之前**那个视图。
   * 旧版关掉时硬写 SIDE，于是从三维排列点一下实时位置再关掉，人就被丢回侧视图。
   */
  schematicView: SceneView
  positionMode: PositionMode
  /** 轨道面是否仍是正对镜头的 ATLAS 姿态 */
  atlasPose: boolean
  /** 轨道展开 HUD 的进度（由 CameraRig 写入，仅用于 UI） */
  unfoldLevel: number
  /** 时间轴回放 */
  playing: boolean
  filterToast: string | null
  /** 移动端菜单抽屉（§17） */
  mobileMenuOpen: boolean
  /** 移动端详情 Bottom Sheet 的档位（§06） */
  sheetState: SheetState
  /** 移动端时间轴抽屉是否展开（V1.1 §2） */
  timelineExpanded: boolean

  enterAtlas: (fast?: boolean) => void
  setMode: (mode: ViewMode) => void
  setCameraState: (state: CameraState) => void
  setViewLayer: (layer: ViewLayer) => void
  toggleLanguage: () => void
  toggleGuide: (open?: boolean) => void
  setSearchOpen: (open: boolean) => void

  select: (id: string | null) => void
  focusPlanet: (id: string) => void
  focusMoon: (id: string) => void
  focusRegion: (id: 'asteroid' | 'kuiper' | 'oort') => void
  focusComet: (id: string) => void
  back: () => void
  returnToAtlas: () => void
  goHome: () => void
  setView: (view: SceneView) => void
  togglePositionMode: () => void
  toggleGrid: (open?: boolean) => void
  toggleSpaceWeather: (open?: boolean) => void
  toggleHideArtificial: (value?: boolean) => void
  toggleHideMoons: (value?: boolean) => void
  toggleHidePlanetOrbits: (value?: boolean) => void
  toggleHideAllOrbits: (value?: boolean) => void
  setOtherOrbitOpacity: (value: number) => void
  setSceneArrangement: (kind: SceneArrangement) => void
  toggleAudio: (value?: boolean) => void
  toggleCreator: (value?: boolean) => void
  openCatalogPanel: (open?: boolean) => void
  openMusicPanel: (open?: boolean) => void
  setCatalogClass: (value: 'ALL' | 'LEO' | 'MEO' | 'GEO') => void
  dismissOnboarding: () => void
  setObjectCategory: (id: string) => void
  setAtlasPose: (value: boolean) => void
  setUnfoldLevel: (value: number) => void
  togglePlay: () => void

  hover: (id: string | null) => void
  setFilter: (id: string) => void
  setTimelineYear: (year: number) => void
  /** 只同步 store 里的年份（连续拖动的节流写入用，见 timelineTime.ts） */
  syncTimelineYear: (year: number) => void
  toggleCatalog: () => void
  openArchive: () => void
  clearFilterToast: () => void
  openMobileMenu: (open?: boolean) => void
  setSheetState: (state: SheetState) => void
  setTimelineExpanded: (expanded: boolean) => void
}

export const useAtlasStore = create<AtlasState>((set) => ({
  activeUi: null, menu: null,
  setMenu: () => {}, closeUi: () => {},
  mode: 'INTRO',
  cameraState: 'FREE',
  viewLayer: 'ATLAS',
  language: 'zh',
  guideOpen: false,
  searchOpen: false,

  focusKind: 'ATLAS',
  focusId: null,
  selectedObjectId: null,
  archiveOpen: false,

  hoveredId: null,
  activeFilter: 'ALL',
  objectCategory: 'ALL',
  timelineYear: 2026,
  catalogVisible: false,
  gridVisible: false,
  spaceWeatherOpen: false,
  hideArtificial: false,
  hideMoons: false,
  hidePlanetOrbits: false,
  hideAllOrbits: false,
  otherOrbitOpacity: 1,
  audioEnabled: true,
  creatorOpen: false,
  catalogPanelOpen: false,
  musicPanelOpen: false,
  catalogClass: 'ALL',
  onboardingDone: false,
  view: 'SIDE',
  schematicView: 'SIDE',
  positionMode: 'SCHEMATIC',
  atlasPose: true,
  unfoldLevel: 0,
  playing: false,
  filterToast: null,
  mobileMenuOpen: false,
  sheetState: 'half',
  timelineExpanded: false,

  enterAtlas: () => set({ mode: 'ENTERING', guideOpen: false }),
  setMode: (mode) => set({ mode }),
  setCameraState: (cameraState) => set({ cameraState }),
  setViewLayer: (viewLayer) => set({ viewLayer }),
  toggleLanguage: () => set((state) => ({ language: state.language === 'zh' ? 'en' : 'zh' })),
  toggleGuide: (open) => set((state) => ({ guideOpen: open ?? !state.guideOpen })),
  setSearchOpen: (searchOpen) => set({ searchOpen }),

  // 航天器：左景右档（方案书 §8）
  select: (id) =>
    set(
      id
        ? {
            selectedObjectId: id,
            focusKind: 'OBJECT',
            focusId: id,
            archiveOpen: false,
            mode: 'OBJECT_FOCUS',
            cameraState: 'FLYING_IN',
            guideOpen: false,
            searchOpen: false,
            mobileMenuOpen: false,
            sheetState: 'half' as SheetState,
            view: 'ORBIT3D',
          }
        : {
            selectedObjectId: null,
            focusKind: 'ATLAS',
            focusId: null,
            archiveOpen: false,
            mode: 'ATLAS',
            cameraState: 'RETURNING',
          }
    ),

  // 行星：镜头以它为原点（方案书 §5 / §7）
  focusPlanet: (id) =>
    set({
      focusKind: 'PLANET',
      focusId: id,
      selectedObjectId: null,
      archiveOpen: false,
      mode: 'SYSTEM_FOCUS',
      cameraState: 'FLYING_IN',
      guideOpen: false,
      searchOpen: false,
      mobileMenuOpen: false,
      sheetState: 'half' as SheetState,
      // 一旦推近到某个天体，镜头就在 3D 里工作了：不再退回侧视（方案书 §3）
      view: 'ORBIT3D',
    }),

  focusMoon: (id) =>
    set({
      focusKind: 'MOON',
      focusId: id,
      selectedObjectId: null,
      archiveOpen: false,
      mode: 'SYSTEM_FOCUS',
      cameraState: 'FLYING_IN',
      guideOpen: false,
      searchOpen: false,
      mobileMenuOpen: false,
      sheetState: 'half' as SheetState,
      view: 'ORBIT3D',
    }),

  /** 小行星带 / 柯伊伯带 / 奥尔特云：和天体一样可以被选中、被聚焦 */
  focusRegion: (id) =>
    set({
      focusKind: 'REGION',
      focusId: id,
      selectedObjectId: null,
      archiveOpen: false,
      mode: 'SYSTEM_FOCUS',
      cameraState: 'FLYING_IN',
      guideOpen: false,
      searchOpen: false,
      mobileMenuOpen: false,
      sheetState: 'half' as SheetState,
      view: 'ORBIT3D',
    }),

  /** 彗星：和行星一样可以聚焦，焦点同样落在画面左侧 */
  focusComet: (id) =>
    set({
      focusKind: 'COMET',
      focusId: id,
      selectedObjectId: null,
      archiveOpen: false,
      mode: 'SYSTEM_FOCUS',
      cameraState: 'FLYING_IN',
      guideOpen: false,
      searchOpen: false,
      mobileMenuOpen: false,
      sheetState: 'half' as SheetState,
      view: 'ORBIT3D',
    }),

  // 返回上一级：航天器 → 母星（月球上的则回月球）→ 总览
  back: () =>
    set((state) => {
      if (state.focusKind === 'OBJECT') {
        const parent = parentOfObject(state.focusId)
        if (!parent) {
          return {
            focusKind: 'ATLAS' as FocusKind,
            focusId: null,
            selectedObjectId: null,
            archiveOpen: false,
            mode: 'ATLAS' as ViewMode,
            cameraState: 'RETURNING' as CameraState,
          }
        }
        return {
          focusKind: parent.kind,
          focusId: parent.id,
          selectedObjectId: null,
          archiveOpen: false,
          mode: 'SYSTEM_FOCUS' as ViewMode,
          cameraState: 'FLYING_IN' as CameraState,
        }
      }
      if (state.focusKind === 'MOON') {
        // 月球属于地球系统：退回它所在的行星系统，而不是笼统的总览
        const moonParent = state.focusId ? MOON_PARENT.get(state.focusId) : undefined
        return {
          focusKind: 'PLANET' as FocusKind,
          focusId: moonParent ?? 'earth',
          selectedObjectId: null,
          archiveOpen: false,
          mode: 'SYSTEM_FOCUS' as ViewMode,
          cameraState: 'FLYING_IN' as CameraState,
        }
      }
      if (state.focusKind === 'REGION') {
        return {
          focusKind: 'ATLAS' as FocusKind,
          focusId: null,
          selectedObjectId: null,
          archiveOpen: false,
          mode: 'ATLAS' as ViewMode,
          cameraState: 'RETURNING' as CameraState,
        }
      }
      if (state.focusKind === 'COMET') {
        return {
          focusKind: 'ATLAS' as FocusKind,
          focusId: null,
          selectedObjectId: null,
          archiveOpen: false,
          mode: 'ATLAS' as ViewMode,
          cameraState: 'RETURNING' as CameraState,
        }
      }
      return {
        focusKind: 'ATLAS' as FocusKind,
        focusId: null,
        selectedObjectId: null,
        archiveOpen: false,
        mode: 'ATLAS' as ViewMode,
        cameraState: 'RETURNING' as CameraState,
      }
    }),

  returnToAtlas: () =>
    set({
      selectedObjectId: null,
      focusKind: 'ATLAS',
      focusId: null,
      archiveOpen: false,
      mode: 'ATLAS',
      cameraState: 'RETURNING',
    }),

  /** HOME：回到落地页，并把视角状态机复位（方案书 §15） */
  goHome: () =>
    set({
      mode: 'INTRO',
      selectedObjectId: null,
      focusKind: 'ATLAS',
      focusId: null,
      archiveOpen: false,
      cameraState: 'FREE',
      guideOpen: false,
      searchOpen: false,
      catalogVisible: false,
      gridVisible: false,
      spaceWeatherOpen: false,
      view: 'SIDE',
      atlasPose: true,
      positionMode: 'SCHEMATIC',
      objectCategory: 'ALL',
      activeFilter: 'ALL',
    }),

  setView: (view) => set({ view }),
  /**
   * 真实位置模式（v5 §11）。
   * 这里必须真的驱动动画：只翻一个布尔值的话，位置映射不会动，
   * 用户看到的就是"点了没反应"。
   */
  togglePositionMode: () =>
    set((state) => {
      const next = state.positionMode === 'REAL' ? 'SCHEMATIC' : 'REAL'
      requestPositionPose(next === 'REAL' ? 1 : 0)
      // 真实位置 = 真实轨道姿态：轨道面一起展开；回到图示排列时压平
      requestOrbitPose(next === 'REAL' ? 1 : 0)
      return {
        positionMode: next,
        view: next === 'REAL' ? ('ORBIT3D' as SceneView) : state.view,
        atlasPose: next !== 'REAL',
      }
    }),
  toggleGrid: (open) => set((state) => ({ gridVisible: open ?? !state.gridVisible })),
  toggleSpaceWeather: (open) =>
    set((state) => ({ spaceWeatherOpen: open ?? !state.spaceWeatherOpen })),
  toggleHideArtificial: (value) =>
    set((state) => ({ hideArtificial: value ?? !state.hideArtificial })),
  toggleHideMoons: (value) => set((state) => ({ hideMoons: value ?? !state.hideMoons })),
  toggleHidePlanetOrbits: (value) =>
    set((state) => ({ hidePlanetOrbits: value ?? !state.hidePlanetOrbits })),
  toggleHideAllOrbits: (value) => set((state) => ({ hideAllOrbits: value ?? !state.hideAllOrbits })),
  setOtherOrbitOpacity: (value) =>
    set({ otherOrbitOpacity: Math.min(1, Math.max(0, value)) }),
  /**
   * 场景排列（v6 §13）。三种排列共用同一套状态机，不再各写一个布尔：
   *   SIDE    位置回到图示排列 + 轨道压平 + 层回到 ATLAS
   *   ORBIT3D 位置仍是图示排列，但轨道展开成真实倾角
   *   REAL    位置换成当前时间的真实黄经，轨道同步展开
   */
  setSceneArrangement: (kind) => {
    requestPositionPose(kind === 'REAL' ? 1 : 0)
    requestOrbitPose(kind === 'SIDE' ? 0 : 1)
    set((state) => ({
      positionMode: kind === 'REAL' ? ('REAL' as PositionMode) : ('SCHEMATIC' as PositionMode),
      view: kind === 'SIDE' ? ('SIDE' as SceneView) : ('ORBIT3D' as SceneView),
      // 记住"非实时"时用的是哪个视图；退出实时位置时回到它，而不是一律回侧视
      schematicView:
        kind === 'REAL'
          ? state.schematicView
          : kind === 'SIDE'
            ? ('SIDE' as SceneView)
            : ('ORBIT3D' as SceneView),
      atlasPose: kind === 'SIDE',
      /**
       * v7 §1：**绝不能**把实时全览映射到 DEEP。
       * DEEP 是那条"退到外太阳系"的取景分支，它的每帧逻辑会在右键松开后
       * 把 yaw / pitch 拉回 home —— 用户看到的就是"转完视角又弹回原点"。
       * 构图由 positionMode 自己决定（realPositionShot），与 viewLayer 无关。
       */
      viewLayer: state.viewLayer === 'DEEP' ? ('ATLAS' as ViewLayer) : state.viewLayer,
    }))
  },
  toggleAudio: (value) => set((state) => ({ audioEnabled: value ?? !state.audioEnabled })),
  toggleCreator: (value) => set((state) => ({ creatorOpen: value ?? !state.creatorOpen })),
  openCatalogPanel: (open) => set((state) => ({ catalogPanelOpen: open ?? !state.catalogPanelOpen })),
  openMusicPanel: (open) => set((state) => ({ musicPanelOpen: open ?? !state.musicPanelOpen })),
  setCatalogClass: (catalogClass) => set({ catalogClass }),
  dismissOnboarding: () => set({ onboardingDone: true }),
  setObjectCategory: (objectCategory) => set({ objectCategory }),

  setAtlasPose: (atlasPose) => set({ atlasPose }),
  setUnfoldLevel: (unfoldLevel) => set({ unfoldLevel }),
  togglePlay: () => set((state) => ({ playing: !state.playing })),

  hover: (hoveredId) => set({ hoveredId }),
  setFilter: (id) => set({ activeFilter: id, filterToast: id }),
  /**
   * v8 §51：**不要再取整**。
   *
   * 旧版这里 Math.round 把目标年份量化成整年，滑杆拖得再细，
   * 星历也只在整年之间跳——用户看到的就是"一格一格地变"。
   * 现在保留浮点：目标的连续变化交给 utils/clock.ts 的阻尼追赶。
   */
  setTimelineYear: (year) =>
    /**
     * V1.1 §5：场景的时间源是浮点连续值（timelineTime.target），
     * store 里的年份只负责 UI 文字。这里两条一起写，
     * 桌面鼠标拖动、深链、回放的行为与 V1 完全一致。
     */
    (forceTimelineTarget(Math.min(CURRENT_YEAR, Math.max(FIRST_LAUNCH_YEAR, year))),
    set({
      timelineYear: Math.min(CURRENT_YEAR, Math.max(FIRST_LAUNCH_YEAR, year)),
    })),
  syncTimelineYear: (year) =>
    set({ timelineYear: Math.min(CURRENT_YEAR, Math.max(FIRST_LAUNCH_YEAR, year)) }),
  toggleCatalog: () => set((state) => ({ catalogVisible: !state.catalogVisible })),
  openArchive: () => set({ archiveOpen: true, cameraState: 'FOCUS' }),
  clearFilterToast: () => set({ filterToast: null }),
  openMobileMenu: (open) => set((state) => ({ mobileMenuOpen: open ?? !state.mobileMenuOpen })),
  setSheetState: (sheetState) => set({ sheetState }),
  setTimelineExpanded: (timelineExpanded) => set({ timelineExpanded }),
}))

// Preserve the exact view the user left, including nested focus navigation.
const focusHistory: Array<{ token: number; state: Partial<AtlasState>; annotations: boolean; context: boolean }> = []
let focusToken = 0
const original = { ...useAtlasStore.getState() }
function saveFocusView() {
  const s = useAtlasStore.getState()
  const { mode, focusKind, focusId, selectedObjectId, archiveOpen, view, viewLayer,
    positionMode, atlasPose, hideArtificial, hideMoons, hidePlanetOrbits, hideAllOrbits,
    /**
     * 面板开合也要一起记（用户 2026-09-25）：从任务图鉴里点进一份档案，
     * 关掉档案时应该回到那张**列表**，而不是回到一个被收起来的空图谱；
     * 反过来，没经过列表就直接进来的，关掉时也不该凭空冒出目录。
     */
    catalogPanelOpen, catalogVisible } = s
  const token = ++focusToken
  const e = useExperience.getState()
  focusHistory.push({ token, state: { mode, focusKind, focusId, selectedObjectId, archiveOpen,
    view, viewLayer, positionMode, atlasPose, hideArtificial, hideMoons, hidePlanetOrbits, hideAllOrbits,
    catalogPanelOpen, catalogVisible },
    annotations: e.annotations, context: e.context })
  window.dispatchEvent(new CustomEvent('atlas-focus-save', { detail: token }))
}
function restoreFocusView(all = false): boolean {
  const saved = all ? focusHistory[0] : focusHistory[focusHistory.length - 1]
  if (!saved) return false
  if (all) focusHistory.length = 0
  else focusHistory.pop()
  useAtlasStore.setState({ ...saved.state, cameraState: 'RETURNING', searchOpen: false, mobileMenuOpen: false })
  requestOrbitPose(saved.state.atlasPose ? 0 : 1)
  requestPositionPose(saved.state.positionMode === 'REAL' ? 1 : 0)
  useExperience.setState({ annotations: saved.annotations, context: saved.context, orbit: false, observation: null })
  window.dispatchEvent(new CustomEvent('atlas-focus-restore', { detail: saved.token }))
  return true
}
function prepareBodyFocus() {
  useExperience.setState({ annotations: true, context: true, orbit: false, observation: null })
  useAtlasStore.setState({ hideAllOrbits: false, hidePlanetOrbits: false, hideMoons: false, hideArtificial: false })
}
useAtlasStore.setState({
  /**
   * **天体（行星 / 卫星 / 区域 / 彗星）换一颗 = 开一段新的浏览分支**（用户 2026-09-25）。
   *
   * 之前是从"卫星档案"里点进它的行星，关闭行星档案会顺着历史退回到那颗卫星的档案——
   * 用户要的是"关闭行星详情 = 全部关掉"。所以天体聚焦不再压历史，直接清空，
   * 关闭时自然回到图谱。任务档案（航天器）仍然压历史：它们属于"任务图鉴"那一层，
   * 关掉要回到列表。
   */
  focusPlanet: id => { focusHistory.length = 0; prepareBodyFocus(); original.focusPlanet(id) },
  focusMoon: id => { focusHistory.length = 0; prepareBodyFocus(); original.focusMoon(id) },
  focusRegion: id => { focusHistory.length = 0; original.focusRegion(id) },
  focusComet: id => { focusHistory.length = 0; original.focusComet(id) },
  select: id => { if (id) { if (useAtlasStore.getState().focusId !== id) saveFocusView(); original.select(id) } else if (!restoreFocusView(true)) original.select(null) },
  back: () => { if (!restoreFocusView()) original.back() },
  returnToAtlas: () => { if (!restoreFocusView(true)) original.returnToAtlas() },
  goHome: () => { focusHistory.length = 0; window.dispatchEvent(new Event('atlas-focus-clear')); original.goHome() },
})

// A panel owns the UI until another panel is requested; focus and camera stay intact.
const coordinated = { ...useAtlasStore.getState() }
function claimUi(activeUi: SolarUi) {
  useAtlasStore.setState({ activeUi, menu: activeUi === 'objects' || activeUi === 'worlds' || activeUi === 'view' ? activeUi : null,
    guideOpen: activeUi === 'guide', searchOpen: activeUi === 'search', creatorOpen: activeUi === 'creator',
    catalogPanelOpen: activeUi === 'catalog', musicPanelOpen: activeUi === 'music', mobileMenuOpen: activeUi === 'mobile',
    timelineExpanded: activeUi === 'time' })
}
function toggleUi(ui: SolarUi, value?: boolean) {
  const current = useAtlasStore.getState().activeUi
  if (value ?? current !== ui) claimUi(ui)
  else if (current === ui) claimUi(null)
}
function restoreUi() {
  const s = useAtlasStore.getState()
  claimUi(s.catalogPanelOpen ? 'catalog' : s.focusKind !== 'ATLAS' ? 'detail' : null)
}
useAtlasStore.setState({
  closeUi: () => claimUi(null),
  setTimelineExpanded: value => toggleUi('time', value),
  setMenu: menu => { if (menu) claimUi(menu); else if (useAtlasStore.getState().menu) claimUi(null) },
  toggleGuide: value => toggleUi('guide', value), setSearchOpen: value => toggleUi('search', value),
  toggleCreator: value => toggleUi('creator', value), openCatalogPanel: value => toggleUi('catalog', value),
  openMusicPanel: value => toggleUi('music', value), openMobileMenu: value => toggleUi('mobile', value),
  focusPlanet: id => { coordinated.focusPlanet(id); claimUi('detail') },
  focusMoon: id => { coordinated.focusMoon(id); claimUi('detail') },
  focusRegion: id => { coordinated.focusRegion(id); claimUi('detail') },
  focusComet: id => { coordinated.focusComet(id); claimUi('detail') },
  select: id => { coordinated.select(id); if (id) claimUi('detail'); else restoreUi() },
  back: () => { coordinated.back(); restoreUi() }, returnToAtlas: () => { coordinated.returnToAtlas(); restoreUi() },
  goHome: () => { coordinated.goHome(); claimUi(null) },
})
