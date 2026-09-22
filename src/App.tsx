import { useEffect, useMemo, useState } from 'react'
import { AtlasCanvas } from './scene/AtlasCanvas'
import { Intro } from './ui/Intro'
import { TopBar } from './ui/TopBar'
import { Timeline } from './ui/Timeline'
import { ObjectArchive } from './ui/ObjectArchive'
import { BodyArchive } from './ui/BodyArchive'
import { RegionArchive } from './ui/RegionArchive'
import { SunArchive } from './ui/SunArchive'
import { CometArchive } from './ui/CometArchive'
import { BackButton } from './ui/BackButton'
import { Cursor } from './ui/Cursor'
import { Onboarding } from './ui/Onboarding'
import { CatalogPanel } from './ui/CatalogPanel'
import { MusicHall } from './ui/MusicHall'
import { AtlasQuote } from './ui/QuoteTicker'
import { SystemTelemetry } from './ui/SystemTelemetry'
import { CreatorPanel } from './ui/CreatorCard'
import { BootScreen } from './ui/BootScreen'
import { audio } from './audio/audioManager'
import { useAtlasStore } from './state/atlasStore'
import { OBJECT_BY_ID, FIRST_LAUNCH_YEAR, CURRENT_YEAR } from './data/objects'
import { useT } from './i18n'
import { requestOrbitPose, setOrbitPoseImmediate, setPositionPoseImmediate } from './utils/orbitPose'

export default function App() {
  /**
   * 进场加载（v7.2）。
   *
   * 先跑一遍素材再放开场：`?boot=0` 跳过（自检截图用），`?boot=hold` 停在加载页
   * （给加载页截图用）。加载期间主场景已经在后面渲染，贴图上传与着色器编译
   * 都在这段时间完成，所以之后点"进入图谱"不会再卡。
   */
  const bootMode = useMemo(
    () => new URLSearchParams(window.location.search).get('boot') ?? '',
    []
  )
  const [booted, setBooted] = useState(false)
  const bootVisible = bootMode !== '0' && !booted
  const mode = useAtlasStore((state) => state.mode)
  const focusKind = useAtlasStore((state) => state.focusKind)
  const focusId = useAtlasStore((state) => state.focusId)
  const selectedObjectId = useAtlasStore((state) => state.selectedObjectId)
  const archiveOpen = useAtlasStore((state) => state.archiveOpen)
  const timelineYear = useAtlasStore((state) => state.timelineYear)
  const t = useT()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const state = useAtlasStore.getState()
      state.setSearchOpen(false)
      state.toggleGuide(false)
      if (state.focusKind !== 'ATLAS') {
        audio.emit('focus.close')
        state.back()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  /**
   * 背景音乐（v9 §3）：进站立即尝试播放；被浏览器策略拦下时，
   * 第一次 pointerdown / keydown 会自动续上，不需要用户去找播放按钮。
   *
   * v9 起全站不再有任何交互音效，所以这里不需要解锁 AudioContext。
   */
  useEffect(() => {
    audio.autoStart()
  }, [])

  // 深链：?object=iss&year=2010 / ?view=atlas（跳过开场）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const objectId = params.get('object')
    const bodyId = params.get('body')
    const view = params.get('view')
    const unfold = params.get('unfold')
    const grid = params.get('grid')
    const position = params.get('position')
    const region = params.get('region')
    const weather = params.get('weather')
    const comet = params.get('comet')
    const catalog = params.get('catalog')
    const music = params.get('music')
    const hide = params.get('hide')
    const year = Number.parseInt(params.get('year') ?? '', 10)
    if (Number.isFinite(year)) {
      useAtlasStore
        .getState()
        .setTimelineYear(Math.min(CURRENT_YEAR, Math.max(FIRST_LAUNCH_YEAR, year)))
    }
    const preUnfold = () => {
      if (unfold !== '1') return
      setOrbitPoseImmediate(1)
      useAtlasStore.getState().setAtlasPose(false)
    }
    const applyLayers = () => {
      const state = useAtlasStore.getState()
      if (grid === '1') state.toggleGrid(true)
      if (position === 'real') {
        setPositionPoseImmediate(1)
        requestOrbitPose(1)
        useAtlasStore.setState({
          positionMode: 'REAL',
          view: 'ORBIT3D',
          atlasPose: false,
        })
      }
      if (weather === '1') state.toggleSpaceWeather(true)
      if (hide === 'artificial') state.toggleHideArtificial(true)
      if (hide === 'planets') state.toggleHidePlanetOrbits(true)
      if (hide === 'all') state.toggleHideAllOrbits(true)
    }
    if (hide) {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const hideTimer = window.setTimeout(applyLayers, 300)
      if (!objectId && !bodyId && !region && !comet) return () => window.clearTimeout(hideTimer)
    }
    if (comet) {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const cometTimer = window.setTimeout(() => {
        preUnfold()
        applyLayers()
        useAtlasStore.getState().focusComet(comet)
      }, 320)
      return () => window.clearTimeout(cometTimer)
    }
    if (grid === '1' || position === 'real' || weather === '1') {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const layerTimer = window.setTimeout(applyLayers, 300)
      // 这些图层在总览里才有意义，但不阻塞其它深链
      if (!objectId && !bodyId && !region) return () => window.clearTimeout(layerTimer)
    }
    if (region) {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const timer = window.setTimeout(() => {
        preUnfold()
        applyLayers()
        useAtlasStore
          .getState()
          .focusRegion(region as 'asteroid' | 'kuiper' | 'oort')
      }, 320)
      return () => window.clearTimeout(timer)
    }
    if (objectId && OBJECT_BY_ID.has(objectId)) {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const timer = window.setTimeout(() => {
        preUnfold()
        applyLayers()
        useAtlasStore.getState().select(objectId)
      }, 320)
      return () => window.clearTimeout(timer)
    }
    if (bodyId) {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const timer = window.setTimeout(() => {
        preUnfold()
        applyLayers()
        useAtlasStore.getState().focusPlanet(bodyId)
      }, 320)
      return () => window.clearTimeout(timer)
    }
    if (view === 'atlas') {
      useAtlasStore.setState({ mode: 'ATLAS' })
    }
    // 自检用深链：?catalog=1 打开在轨目录面板，?music=1 打开背景音乐面板
    if (catalog === '1') {
      useAtlasStore.setState({ mode: 'ATLAS' })
      const timer = window.setTimeout(() => {
        useAtlasStore.getState().openCatalogPanel(true)
        if (!useAtlasStore.getState().catalogVisible) useAtlasStore.getState().toggleCatalog()
      }, 320)
      return () => window.clearTimeout(timer)
    }
    if (music === '1') {
      useAtlasStore.setState({ mode: 'ATLAS' })
      useAtlasStore.getState().openMusicPanel(true)
    }
    if (view === 'deep') {
      useAtlasStore.setState({ mode: 'ATLAS' })
      useAtlasStore.getState().setViewLayer('DEEP')
    }
    if (view === 'unfold') {
      useAtlasStore.setState({ mode: 'ATLAS' })
      setOrbitPoseImmediate(1)
      useAtlasStore.getState().setAtlasPose(false)
    }
  }, [])

  const atlasVisible = mode !== 'INTRO'
  const focused = focusKind !== 'ATLAS'
  const view = useAtlasStore((state) => state.view)
  const gridVisible = useAtlasStore((state) => state.gridVisible)
  // 左上角有返回键时，主标题要往下让位，否则两者会叠在一起（方案书 §15）
  const hasBack = focusKind !== 'ATLAS' || view === 'ORBIT3D'
  // 右侧出现档案面板时，顶部导航与底部时间轴都要让位，不能钻到面板底下
  const panelOpen =
    focusKind === 'PLANET' ||
    focusKind === 'MOON' ||
    focusKind === 'REGION' ||
    focusKind === 'COMET' ||
    (archiveOpen && focusKind === 'OBJECT')

  return (
    <div
      className="atlas"
      data-mode={mode}
      data-archive={archiveOpen ? 'open' : 'closed'}
      data-focus={focusKind.toLowerCase()}
      data-back={hasBack ? 'yes' : 'no'}
      data-panel={panelOpen ? 'open' : 'closed'}
      data-grid={gridVisible ? 'on' : 'off'}
      data-year={timelineYear}
    >
      <AtlasCanvas />
      <div id="label-layer" className="label-layer" />
      {/* v8 §27：行星表面全息标注层（贴在球面上的科学标签） */}
      <div id="holo-layer" className="holo-layer" />
      <Cursor />
      <div className="vignette" />
      <div className="grain" />

      <div className={`ui-layer${atlasVisible ? ' is-visible' : ''}`}>
        {focused ? null : (
        <div className={`masthead${atlasVisible ? ' is-in' : ''}`}>
          <h1>{t('brand.title')}</h1>
          <i />
          <p>
            {t('brand.sub1')}
            <br />
            {t('brand.sub2')}
          </p>
          <div className="masthead__count">{OBJECT_BY_ID.size} {t('stats.objects')}</div>
        </div>
        )}

        <BackButton />
        <TopBar />
        <Onboarding />
        <Timeline />
        {/* v9 §23：右上角的系统详情（在原工具区上方，不改动原布局） */}
        <SystemTelemetry />
        {/* v9 §8：作者 / 版权面板 */}
        <CreatorPanel />
        {/* v9 §7：图谱左下角的"天文学思想长廊" */}
        <AtlasQuote />

        {archiveOpen && selectedObjectId && focusKind === 'OBJECT' ? (
          <ObjectArchive objectId={selectedObjectId} />
        ) : null}
        {focusKind === 'PLANET' && focusId === 'sun' ? <SunArchive /> : null}
        {(focusKind === 'PLANET' || focusKind === 'MOON') && focusId && focusId !== 'sun' ? (
          <BodyArchive kind={focusKind} id={focusId} />
        ) : null}
        {focusKind === 'REGION' && focusId ? <RegionArchive id={focusId} /> : null}
        {focusKind === 'COMET' && focusId ? <CometArchive id={focusId} /> : null}
        <CatalogPanel />
        {/* v8.1：专门的音乐播放界面（整张专辑 + 播放源切换） */}
        <MusicHall />
      </div>

      {/* 开场只在加载完成之后挂载：它的逐字解码动画必须从头开始，而不是被加载页挡掉一半 */}
      {bootMode === '0' || booted ? <Intro /> : null}
      {bootVisible ? <BootScreen hold={bootMode === 'hold'} onDone={() => setBooted(true)} /> : null}
    </div>
  )
}
