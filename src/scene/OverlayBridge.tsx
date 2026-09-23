import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PLANETS } from '../data/planets'
import { OBJECTS } from '../data/objects'
import { FILTER_BY_ID } from '../data/filters'
import { LabelLayer } from './labelLayer'
import { getCatalogStats } from './EarthCatalog'
import { getWorld, objectWeight } from '../utils/world'
import { smoothYear, worldNow } from '../utils/clock'
import { useAtlasStore } from '../state/atlasStore'
import { yearOf } from '../utils/formatters'
import { BELT_RANGE, KUIPER_RANGE, OORT_RANGE } from '../utils/layout'
import { COMETS } from '../data/comets'
import { cometPosition, cometSunDistance } from '../astronomy/cometOrbit'
import { satelliteVisibility } from '../utils/reveal'
import { getLayoutMode } from '../responsive/device'
import { adaptiveQuality } from '../performance/AdaptiveQualityManager'

interface PickTarget {
  id: string
  kind: 'planet' | 'moon' | 'object' | 'region' | 'sun' | 'comet'
  x: number
  y: number
  radius: number
}

const CLICK_SLOP = 5

/** V1.1 §22：手指的 tap 容差（鼠标仍然是 5px） */
const TOUCH_CLICK_SLOP = 10

/** 命中区与视觉大小分离（方案书 §6.2）：标记很小，但一定点得到 */
const HIT_RADIUS: Record<PickTarget['kind'], number> = {
  planet: 24,
  moon: 16,
  object: 15,
  region: 30,
  sun: 34,
  comet: 20,
}

/**
 * V1 §24：手指没有鼠标那么准。
 * 手机上把命中区整体放大到 2.2 倍（物体那一档 15px → 33px），
 * 视觉半径不变——"看得见的小点，点得到的靶心"。
 */
const MOBILE_HIT_SCALE = 2.2

function hitRadiusOf(kind: PickTarget['kind']): number {
  const base = HIT_RADIUS[kind]
  return getLayoutMode() === 'desktop' ? base : Math.round(base * MOBILE_HIT_SCALE)
}

/**
 * 3D 与 DOM 的桥：
 * 1) 每帧把 Anchor 投影成屏幕坐标，驱动 DOM 标签；
 * 2) 用投影结果做屏幕空间拾取（比 raycast 更精准，也不受点精灵尺寸影响）；
 * 3) 驱动太阳的镜头光斑（DOM 层）。
 */
export function OverlayBridge({ containerId = 'label-layer' }: { containerId?: string }) {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)
  const layerRef = useRef<LabelLayer | null>(null)
  const flareRef = useRef<HTMLDivElement | null>(null)
  const targetsRef = useRef<PickTarget[]>([])
  const pointerRef = useRef({ x: -9999, y: -9999, downX: 0, downY: 0, active: false })

  // 建立全部 DOM 标签
  useEffect(() => {
    const container = document.getElementById(containerId)
    if (!container) return
    const layer = new LabelLayer(container)
    layerRef.current = layer
    for (const planet of PLANETS) {
      layer.ensure(`planet:${planet.id}`, 'planet', planet.name, planet.nameCn)
    }
    // 所有天然卫星都有标签；显示密度由每帧的屏幕空间判定控制（土星一家有十几颗）
    for (const planet of PLANETS) {
      for (const moon of planet.moons) {
        layer.ensure(`moon:${moon.id}`, 'moon', moon.name, moon.nameCn)
      }
    }
    for (const object of OBJECTS) {
      layer.ensure(`object:${object.id}`, 'object', object.name, String(yearOf(object.launched)))
    }
    layer.ensure('belt:asteroid', 'region', 'ASTEROID BELT', '小行星带')
    layer.ensure('belt:kuiper', 'region', 'KUIPER BELT', '柯伊伯带')
    layer.ensure('belt:oort', 'region', 'OORT CLOUD', '奥尔特云')
    for (const comet of COMETS) {
      layer.ensure(`comet:${comet.id}`, 'moon', comet.name, comet.nameCn)
      // 彗星本体是一枚平面 UI：核 + 尾迹方向线（3D 里只有那条轨道）
      layer.ensureCometMarker(`comet:${comet.id}`)
    }

    const flare = document.createElement('div')
    flare.className = 'flare'
    flare.innerHTML =
      '<i class="flare__core"></i>' +
      [0, 1, 2, 3].map((index) => `<i class="flare__ghost" data-g="${index}"></i>`).join('')
    container.appendChild(flare)
    flareRef.current = flare

    return () => {
      layer.dispose()
      flare.remove()
      layerRef.current = null
      flareRef.current = null
    }
  }, [containerId])

  // 指针：hover 判定 + 点击判定
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      pointerRef.current.x = event.clientX
      pointerRef.current.y = event.clientY
    }
    const onDown = (event: PointerEvent) => {
      pointerRef.current.downX = event.clientX
      pointerRef.current.downY = event.clientY
      pointerRef.current.active = true
    }
    const onUp = (event: PointerEvent) => {
      const state = useAtlasStore.getState()
      const moved =
        Math.abs(event.clientX - pointerRef.current.downX) +
        Math.abs(event.clientY - pointerRef.current.downY)
      pointerRef.current.active = false
      if (event.button !== 0) return
      /**
       * V1.1 §22：Tap 与 Drag 必须分开判。
       * 鼠标 5px（V1 原值，桌面不变），手指 10px —— 手指按下时天然会挪几像素，
       * 用 5px 会在旋转太阳系的时候误选到星球。
       */
      const slop = event.pointerType === 'mouse' ? CLICK_SLOP : TOUCH_CLICK_SLOP
      if (moved > slop) return
      if (event.target !== gl.domElement) return

      const hit = pick(targetsRef.current, event.clientX, event.clientY)
      if (hit?.kind === 'planet') state.focusPlanet(hit.id)
      else if (hit?.kind === 'moon') state.focusMoon(hit.id)
      else if (hit?.kind === 'object') state.select(hit.id)
      else if (hit?.kind === 'sun') state.focusPlanet('sun')
      else if (hit?.kind === 'comet') state.focusComet(hit.id)
      else if (hit?.kind === 'region')
        state.focusRegion(hit.id as 'asteroid' | 'kuiper' | 'oort')
      else if (state.focusKind !== 'ATLAS') state.back()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
    }
  }, [gl])

  useFrame((state) => {
    const layer = layerRef.current
    if (!layer) return
    const clock = worldNow()
    const world = getWorld(clock)
    const { hoveredId, selectedObjectId, activeFilter, timelineYear, mode } =
      useAtlasStore.getState()
    const { hideArtificial, hideAllOrbits } = useAtlasStore.getState()
    /** V1 §28：总览里的手机只留"主视觉对象"，聚焦某个系统时才放开第二档 */
    const atlasOverview = useAtlasStore.getState().focusKind === 'ATLAS'
    /** 触屏布局（手机 / 平板）：标签排布更严；桌面保持 V1 原样 */
    const touchLayout = getLayoutMode() !== 'desktop'
    const artificialHidden = hideArtificial || hideAllOrbits
    // 自然卫星被隐藏时，它们的标签与命中区一起退场（v6 §13）
    const moonsHidden = useAtlasStore.getState().hideMoons
    const filter = FILTER_BY_ID.get(activeFilter)
    // 正交相机：可见世界高度才是"离得多近"的度量
    const viewHeight = (camera.top - camera.bottom) / (camera.zoom || 1)
    const ndc = new THREE.Vector3()
    const targets: PickTarget[] = []

    const project = (position: THREE.Vector3) => {
      ndc.copy(position).project(camera)
      const x = (ndc.x * 0.5 + 0.5) * size.width
      const y = (-ndc.y * 0.5 + 0.5) * size.height
      return { x, y, visible: ndc.z > -1 && ndc.z < 1 }
    }
    const screenRadiusOf = (worldRadius: number) =>
      (worldRadius / Math.max(viewHeight, 0.001)) * size.height * 0.5

    const introVisible = mode !== 'INTRO'
    // UI 保留区：左上角的主标题 / 返回键，右上角的导航栏。
    // 落在这里的标签要压到很淡，否则文字会压住 UI（方案书 §15 / 验收：UI 不互相覆盖）。
    const uiBlocked = (x: number, y: number) =>
      (y < 182 && x < 470) || (y < 74 && x > size.width - 900)
    const uiPenalty = (x: number, y: number) => (uiBlocked(x, y) ? 0.1 : 1)

    // ---- 太阳：可点击、可聚焦（v5 §17） ----
    if (introVisible) {
      const sun = project(new THREE.Vector3(0, 0, 0))
      if (sun.visible) {
        const radius = Math.max(screenRadiusOf(4.5), hitRadiusOf('sun'))
        targets.push({ id: 'sun', kind: 'sun', x: sun.x, y: sun.y, radius })
      }
    }

    // ---- 行星标签与命中区：图谱的骨架 ----
    /**
     * 行星标签也去簇（v7.1 §4 "先读成一条带，而不是一团字"）。
     *
     * 行星标签是上/下交替摆的，正常取景下互不相干；但缩到总览以外时，
     * 内行星的屏幕 x 会收敛到太阳附近，同一侧的两个标签就叠成
     * "MERCURYEARTH"。这里在检测到同高度、近 x 时逐级往同侧外推。
     */
    const planetLabels: Array<{ x: number; dy: number }> = []
    for (let index = 0; index < world.layout.planets.length; index++) {
      const anchor = world.layout.planets[index]!
      const { x, y, visible } = project(anchor.position)
      const onScreen = visible && x > -140 && x < size.width + 140 && y > -90 && y < size.height + 90
      const screenRadius = screenRadiusOf(anchor.planet.radius)
      const up = index % 2 === 0
      const offsetX = Math.max(30, screenRadius + 18)
      const baseOffsetY = up
        ? -Math.max(20, screenRadius * 0.55)
        : Math.max(26, screenRadius * 0.75) + (screenRadius > 40 ? 30 : 0)
      let offsetY = baseOffsetY
      /**
       * 触屏设备的错位参数更宽一档：手机上行星挨得近，
       * 用桌面的 118px 判定会放行一对实际会叠字的名字
       * （实测"JUPITER × URANUS"）。桌面数值保持 V1 不变。
       */
      const planetGapX = touchLayout ? 170 : 118
      const planetGapY = touchLayout ? 26 : 20
      const planetStepY = touchLayout ? 30 : 26
      for (let attempt = 1; attempt <= 4; attempt++) {
        const collides = planetLabels.some(
          (used) =>
            Math.abs(used.x - x) < planetGapX && Math.abs(used.dy - offsetY) < planetGapY
        )
        if (!collides) break
        offsetY = baseOffsetY + (up ? -1 : 1) * attempt * planetStepY
      }
      planetLabels.push({ x, dy: offsetY })
      /**
       * 真机反馈：手机竖屏里水星和木星的名字会压在一起。
       * 上面的错位循环最多重试 4 次，实在放不下时：
       * 桌面上画面宽，不会走到这里；手机上就**宁可少一个名字**，
       * 也不要两个字叠在一起（点击命中区照常保留，放大一点就又有名字）。
       */
      const crowded =
        touchLayout &&
        planetLabels.slice(0, -1).some(
          (used) =>
            Math.abs(used.x - x) < planetGapX && Math.abs(used.dy - offsetY) < planetGapY
        )
      layer.update(
        `planet:${anchor.planet.id}`,
        x,
        y,
        offsetX,
        offsetY,
        introVisible && onScreen && !crowded ? 0.92 * uiPenalty(x, y) : 0,
        { flip: x > size.width - 220 }
      )
      if (onScreen && introVisible) {
        targets.push({
          id: anchor.planet.id,
          kind: 'planet',
          x,
          y,
          radius: Math.max(screenRadius, hitRadiusOf('planet')),
        })
      }
    }

    // ---- 天然卫星：镜头靠近某颗行星时逐层展开，并按屏幕密度去重 ----
    /**
     * V1 §23：Semantic LOD。
     *
     * 数据一个都不删，只是手机屏幕装不下桌面那份标签密度：
     *   · 三档物体（importance 3+）默认不出标签，选中 / 悬停时照常出现
     *   · 标签间距整体放大 35%，避免叠字
     *   · 小卫星（reveal < 0.42 那档）在手机上直接让位
     * 桌面端 mobileLod === false，所有门限与 V1 之前逐字相同。
     */
    const mobileLod = getLayoutMode() !== 'desktop'
    /**
     * V1.1 §12 第 5 / 13 步：标签数量是降级阶梯里的独立一级。
     * labelDensity 从 1 一路降到 0.45，标签间距随之收紧——
     * 桌面恒为 1，标签排布与 V1 逐字相同。
     */
    const labelDensity = adaptiveQuality.settings.labelDensity
    /**
     * 真机反馈"标签糊成一片"：手机总览上标签间距再放宽，
     * 并**按 LOD 增益同步放大**——增益让更多物体进入可见范围，
     * 间距必须跟着放大才不会又挤回一团。桌面 gapScale 仍是 1。
     */
    const gapScale = (mobileLod ? 1.55 : 1) * (2 - Math.min(1, labelDensity))
    const moonOccupied: Array<{ x: number; y: number; importance: number }> = []
    const orderedMoons = [...world.layout.moons].sort((a, b) => b.def.radius - a.def.radius)
    for (const moon of orderedMoons) {
      if (moonsHidden) {
        layer.update(`moon:${moon.id}`, 0, 0, 0, 0, 0)
        continue
      }
      const diskRadius = world.systems.get(moon.diskId)?.radius ?? 6
      const reveal = THREE.MathUtils.clamp(
        // 推近到某个行星系统时，它的卫星标签必须真的展开：
        // 用一个能在"聚焦行星"的取景高度上到 1 的阈值。
        (diskRadius * 6 - viewHeight) / Math.max(diskRadius * 2.4, 0.6),
        0,
        1
      )
      const { x, y, visible } = project(moon.position)
      const onScreen = visible && x > -60 && x < size.width + 60 && y > -40 && y < size.height + 40
      // 大卫星永远有名字；小卫星只在推近到能看清的时候才出现，避免标签糊成一片
      const isMajor = moon.def.radius >= 0.09
      const mine = reveal * (isMajor ? 1 : 0.85)
      let blocked = !isMajor && reveal < (mobileLod ? 0.58 : 0.42)
      // 画质降到中档以下时，小卫星的标签先让位（§12 第 5 步）
      if (!blocked && labelDensity < 0.6 && !isMajor) blocked = true
      if (!blocked) {
        const gap = (isMajor ? 30 : 42) * gapScale
        for (const used of moonOccupied) {
          if (Math.hypot(used.x - x, used.y - y) < gap) {
            blocked = true
            break
          }
        }
      }
      if (!blocked) {
        moonOccupied.push({ x, y, importance: isMajor ? 1 : 2 })
      }
      layer.update(
        `moon:${moon.id}`,
        x,
        y,
        18,
        14,
        introVisible && onScreen && !blocked ? mine * 0.8 * uiPenalty(x, y) : 0,
        {
          flip: x > size.width - 240,
          hovered: hoveredId === moon.id,
        }
      )
      if (onScreen && reveal > 0.3 && introVisible) {
        const screenRadius = Math.max(7, screenRadiusOf(moon.def.radius))
        targets.push({
          id: moon.id,
          kind: 'moon',
          x,
          y,
          radius: Math.max(Math.min(screenRadius, 20), hitRadiusOf('moon')),
        })
      }
    }

    // ---- 在轨目录注解 ----
    const catalogStats = getCatalogStats()
    const catalogVisible = useAtlasStore.getState().catalogVisible
    const earthAnchor = world.planets.get('earth')
    if (catalogStats && earthAnchor) {
      layer.ensure(
        'catalog:earth',
        'moon',
        'EARTH ORBIT CATALOG',
        `${catalogStats.count.toLocaleString('en-US')} TRACKED OBJECTS · NOT TO SCALE`
      )
      const { x, y, visible } = project(earthAnchor.position)
      layer.update('catalog:earth', x, y, 36, 60, visible && catalogVisible ? 0.72 : 0, { flip: false })
    }

    // ---- 人类造物标签：按重要度排布，屏幕重叠时优先牺牲低重要度（方案书 §28）----
    const occupied: Array<{ x: number; y: number; importance: number }> = []
    const ordered = [...world.layout.objects].sort(
      (a, b) => (a.object.importance ?? 2) - (b.object.importance ?? 2)
    )
    for (const anchor of ordered) {
      const object = anchor.object
      const importance = object.importance ?? 2
      const weight = objectWeight(yearOf(object.launched), filter ? filter.match(object) : true, timelineYear)
      const isHovered = hoveredId === object.id
      const isSelected = selectedObjectId === object.id
      const { x, y, visible } = project(anchor.position)

      const diskRadius = anchor.diskId ? world.systems.get(anchor.diskId)?.radius ?? 6 : 12
      /**
       * v8.2：标签与节点、轨道共用同一个系统可见度。
       * 旧版这里是自己一套 near 公式，于是出现"轨道出来了、点还在、
       * 名字却是另一个节奏"的三套时间线。
       */
      const systemDiskScreen = (diskRadius / Math.max(viewHeight, 0.001)) * size.height * 0.5
      const baseReveal = anchor.deep ? 0.75 : satelliteVisibility(systemDiskScreen)
      const reveal =
        isHovered || isSelected
          ? 1
          : importance === 1
            ? Math.max(0.55, baseReveal)
            : importance === 2
              ? baseReveal
              : baseReveal * 0.45

      /**
       * 去簇（v7 §12 的"检查位置"）。
       *
       * 旧版只比锚点距离，而且遇到重要度 1 的标签时门限被压到 20px：
       * 于是"HUBBLE SPACE TELESCOPE"这种 150px 宽的长标签旁边，
       * 只要锚点差 20px 就能再塞一个标签，地球周围就糊成一团。
       * 现在两条判断：锚点距离取两者中更严的那档，外加同一高度带里的水平间距。
       */
      const gapOf = (level: number) => (level === 1 ? 34 : level === 2 ? 58 : 86)
      const gap = gapOf(importance) * gapScale
      let blocked = false
      for (const used of occupied) {
        const dy = Math.abs(used.y - y)
        const dx = Math.abs(used.x - x)
        if (
          Math.hypot(dx, dy) < Math.max(gap, gapOf(used.importance) * gapScale) ||
          (dy < 16 * gapScale && dx < 120 * gapScale)
        ) {
          blocked = true
          break
        }
      }
      if (!blocked) occupied.push({ x, y, importance })

      const onScreen = visible && x > -160 && x < size.width + 160 && y > -80 && y < size.height + 80
      /**
       * 手机上默认不出标签的档位（选中 / 悬停时例外）：
       *   总览     只留 importance 1 —— 手机总览上的注释控制在个位数
       *   聚焦系统 放开到 importance 2 —— 这时候用户就是在读这个系统
       */
      const lodLimit = atlasOverview ? 1 : 2
      const lodHidden = mobileLod && importance > lodLimit && !isHovered && !isSelected
      const opacity =
        !artificialHidden && introVisible && onScreen && !blocked && !lodHidden
          ? Math.min(1, weight) * reveal * 0.95 * uiPenalty(x, y)
          : 0
      const side = anchor.labelSide
      const flip = x > size.width - 300
      layer.update(
        `object:${object.id}`,
        x,
        y,
        flip ? 22 : side > 0 ? 22 : -22,
        side > 0 ? -20 : 20,
        opacity,
        { hovered: isHovered, selected: isSelected, dimmed: !filter?.match(object), flip }
      )

      if (onScreen && weight > 0.05 && introVisible && !artificialHidden) {
        targets.push({
          id: object.id,
          kind: 'object',
          x,
          y,
          radius:
            isSelected || isHovered
              ? hitRadiusOf('object') + 6
              : hitRadiusOf('object'),
        })
      }
    }

    // ---- 三圈大尺度结构的标注：只在缩到能看见它们的时候出现 ----
    const regionLabel = (
      key: string,
      worldRadius: number,
      sideSign: number,
      fade: number,
      pickRadius = 0
    ) => {
      const position = new THREE.Vector3(Math.cos(sideSign) * worldRadius, 0, Math.sin(sideSign) * worldRadius)
      const { x, y, visible } = project(position)
      const onScreen = visible && x > -200 && x < size.width + 200 && y > -60 && y < size.height + 60
      const opacity = introVisible && onScreen ? fade * uiPenalty(x, y) : 0
      layer.update(key, x, y, 16, -18, opacity, { flip: false })
      // 三圈结构是可点选对象，不是背景装饰（方案书 §18）
      if (opacity > 0.06 && pickRadius > 0) {
        targets.push({ id: key.replace('belt:', ''), kind: 'region', x, y, radius: pickRadius })
      }
    }
    /**
     * 真机反馈"标签糊成一片"：手机上三圈大尺度结构**互相叠在画面同一侧**，
     * 总览里只留小行星带（它是内太阳系的一部分），柯伊伯带与奥尔特云
     * 在聚焦 / 缩放到远处时才出现。桌面不受影响（mobileLod 恒为 false）。
     */
    regionLabel(
      'belt:asteroid',
      BELT_RANGE.outer * 0.86,
      Math.PI * 0.86,
      mobileLod ? 0.45 : 0.6,
      34
    )
    regionLabel(
      'belt:kuiper',
      KUIPER_RANGE.outer * 0.86,
      Math.PI * 0.86,
      mobileLod
        ? 0
        : THREE.MathUtils.clamp((viewHeight - 92) / 90, 0, 1) * 0.55,
      34
    )
    regionLabel(
      'belt:oort',
      OORT_RANGE.inner * 0.86,
      Math.PI * 0.86,
      mobileLod
        ? 0
        : THREE.MathUtils.clamp((viewHeight - 140) / 110, 0, 1) * 0.5,
      34
    )

    // ---- 黄道网格的 AU 刻度：网格本身在 3D 里，读数在这里 ----
    if (useAtlasStore.getState().gridVisible) {
      for (const planet of PLANETS) {
        layer.ensure(
          `grid:${planet.id}`,
          'region',
          `${planet.realAu.toFixed(2)} AU`,
          planet.nameCn
        )
        const theta = -0.34
        const position = new THREE.Vector3(
          Math.cos(theta) * planet.displayDistance,
          0,
          Math.sin(theta) * planet.displayDistance
        )
        const { x, y, visible } = project(position)
        const onScreen = visible && x > -80 && x < size.width + 80 && y > -50 && y < size.height + 50
        layer.update(`grid:${planet.id}`, x, y, 10, -12, onScreen ? 0.46 : 0, { flip: false })
      }
    } else {
      for (const planet of PLANETS) {
        layer.update(`grid:${planet.id}`, 0, 0, 0, 0, 0)
      }
    }

    /**
     * ---- 彗星：位置由真实轨道要素决定，本体用平面 UI 画 ----
     *
     * v9.2：**这段绝不能受"隐藏人造卫星/隐藏所有轨道"的影响**。
     * 之前它被包在 `if (!artificialHidden)` 里，于是用户一隐藏轨道，
     * 彗星标记就停止更新、冻在屏幕上：转动视角它还在原地不动。
     * 彗星不是人造卫星，轨道线由 hideAllOrbits 单独控制即可。
     */
    {
      // v7 §13：彗星位置跟着**平滑年份**走，拖时间轴时是连续滑动
      const year = smoothYear()
      for (const comet of COMETS) {
        const position = cometPosition(comet, year)
        const { x, y, visible } = project(position)
        const onScreen =
          visible && x > -140 && x < size.width + 140 && y > -90 && y < size.height + 90
        /**
         * 手机总览里四颗彗星的名字会和行星标签抢位置（真机反馈），
         * 只在聚焦它们、或被选中/悬停时出名字；彗核标记本身始终保留。
         */
        const cometLabelVisible =
          !mobileLod || !atlasOverview || hoveredId === comet.id || selectedObjectId === comet.id
        layer.update(
          `comet:${comet.id}`,
          x,
          y,
          20,
          16,
          onScreen && cometLabelVisible ? 0.68 * uiPenalty(x, y) : 0,
          {
            flip: x > size.width - 260,
            hovered: hoveredId === comet.id,
          }
        )
        /**
         * v7 §12：不再画尾迹线。越靠近太阳越活跃，只体现为彗核标记略大一点。
         */
        const activity = THREE.MathUtils.clamp(1.6 / Math.max(cometSunDistance(comet, year), 0.25), 0, 1.6)
        const scale = 0.9 + (activity / 1.6) * 0.45
        layer.updateCometMarker(
          `comet:${comet.id}`,
          x,
          y,
          scale,
          onScreen ? 0.75 * uiPenalty(x, y) : 0,
          {
            hovered: hoveredId === comet.id,
            selected: selectedObjectId === comet.id,
          }
        )
        if (onScreen) {
          targets.push({ id: comet.id, kind: 'comet', x, y, radius: hitRadiusOf('comet') })
        }
      }
    }

    targetsRef.current = targets
    updateFlare(flareRef.current, project, world, size.width, size.height, screenRadiusOf, viewHeight)

    // hover 判定（在投影之后，用同一帧坐标）
    const pointer = pointerRef.current
    const hit = pick(targets, pointer.x, pointer.y)
    const currentHovered = useAtlasStore.getState().hoveredId
    if ((hit?.id ?? null) !== currentHovered) {
      useAtlasStore.getState().hover(hit?.id ?? null)
      gl.domElement.style.cursor = hit ? 'pointer' : 'crosshair'
    }
  })

  return null
}

/**
 * 太阳的镜头光斑（方案书 §11）：沿"光源 → 画面中心"的轴线排布几个 ghost。
 * 有行星挡住太阳时整体淡出——光斑是真的被遮挡，不是画上去的装饰。
 */
function updateFlare(
  flare: HTMLDivElement | null,
  project: (position: THREE.Vector3) => { x: number; y: number; visible: boolean },
  world: ReturnType<typeof getWorld>,
  width: number,
  height: number,
  screenRadiusOf: (worldRadius: number) => number,
  viewHeight: number
) {
  if (!flare) return
  const sun = project(new THREE.Vector3(0, 0, 0))
  if (!sun.visible) {
    flare.style.opacity = '0'
    return
  }

  let occluded = false
  for (const anchor of world.layout.planets) {
    const point = project(anchor.position)
    const radius = screenRadiusOf(anchor.planet.radius)
    if (Math.hypot(point.x - sun.x, point.y - sun.y) < radius * 0.94) {
      occluded = true
      break
    }
  }
  if (!occluded) {
    for (const moon of world.layout.moons) {
      if (moon.def.radius < 0.08) continue
      const point = project(moon.position)
      const radius = screenRadiusOf(moon.def.radius)
      if (Math.hypot(point.x - sun.x, point.y - sun.y) < radius * 0.94) {
        occluded = true
        break
      }
    }
  }

  flare.style.transform = `translate3d(${sun.x.toFixed(1)}px, ${sun.y.toFixed(1)}px, 0)`
  // 眩光只属于"总览尺度"。推近到某个天体后，太阳的光斑会在画面里变成一团
  // 说不清是什么的雾——那正是背景看起来脏的原因，所以缩到一定尺度就淡出。
  const scaleFade = THREE.MathUtils.clamp((viewHeight - 16) / 40, 0, 1)
  flare.style.opacity = occluded ? '0' : scaleFade.toFixed(3)

  const axisX = width / 2 - sun.x
  const axisY = height / 2 - sun.y
  const stops = [0.34, 0.68, 1.12, 1.55]
  const scales = [0.5, 0.28, 0.62, 0.22]
  const ghosts = flare.querySelectorAll<HTMLElement>('.flare__ghost')
  ghosts.forEach((ghost, index) => {
    const k = stops[index] ?? 0.5
    ghost.style.transform =
      `translate3d(${(axisX * k).toFixed(1)}px, ${(axisY * k).toFixed(1)}px, 0) ` +
      `scale(${(scales[index] ?? 0.4).toFixed(2)})`
  })
}

/** 屏幕空间拾取：取最近的一个命中目标 */
function pick(targets: PickTarget[], x: number, y: number): PickTarget | null {
  let best: PickTarget | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const target of targets) {
    const distance = Math.hypot(target.x - x, target.y - y)
    if (distance <= target.radius && distance < bestDistance) {
      best = target
      bestDistance = distance
    }
  }
  return best
}
