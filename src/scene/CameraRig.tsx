import { useExperience } from '../state/experience'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtlasStore, type FocusKind } from '../state/atlasStore'
import { advanceTime, worldNow } from '../utils/clock'
import { advanceYear, smoothYear } from '../utils/clock'
import { getWorld } from '../utils/world'
import { applyDiskFrame, SIDE_VIEW_PITCH, SIDE_VIEW_YAW } from '../utils/diskFrame'
import { ATLAS_OUTER_RADIUS, DISK_RADIUS, REGIONS, SUN_RADIUS } from '../utils/layout'
import {
  advanceSpacing,
  advanceOrbitPose,
  advancePositionPose,
  snapSpacing,
  SPACING_COMPACT,
  requestPositionPose,
  setOrbitPoseImmediate,
  setPositionPoseImmediate,
  spacingScale,
  orbitPose,
  requestOrbitPose,
  UNFOLD_DURATION,
} from '../utils/orbitPose'
import { PLANET_BY_ID } from '../data/planets'
import { COMET_BY_ID } from '../data/comets'
import { cometDisplayPosition } from '../astronomy/cometOrbit'
import type { PlanetDef, SystemId } from '../data/types'
import { sceneReveal } from '../utils/reveal'
import { planetDim } from '../utils/glStats'
import { audio } from '../audio/audioManager'
import { getLayoutMode, isTouchLayout } from '../responsive/device'
import { gestureManager } from '../gesture'

/**
 * 镜头导演（方案书 §2 / §5 / §7 / §23）。
 *
 * 两种工作方式：
 *   • ATLAS —— 正交相机停在侧视图上，构图由 ATLAS_FIT_* 自动算出，不写死相机距离。
 *   • FOCUS —— target 绑定到被选中的天体 / 航天器，每帧跟随它的世界坐标；
 *              右键拖拽于是自然地变成"以它为原点旋转"。
 */

interface Shot {
  target: THREE.Vector3
  height: number
  yaw: number
  pitch: number
}

interface Flight {
  from: Shot
  to: Shot
  start: number
  duration: number
  kind: 'in' | 'out'
}

const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

function cloneShot(shot: Shot): Shot {
  return { target: shot.target.clone(), height: shot.height, yaw: shot.yaw, pitch: shot.pitch }
}

/**
 * 图谱的**固定取景尺度**（用户 2026-09-25）。
 *
 * 侧视 / 三维 / 实时三种排列共用这一个高度：切换排列只换行星位置与轨道姿态，
 * 镜头距离一步都不动。旧版每种排列各算一套高度（三维装整条轨道、实时装整圈），
 * 于是"点一下实时位置"画面就先缩再放。
 */
function atlasFrameHeight(aspect: number): number {
  const spanX = (ATLAS_OUTER_RADIUS + 20 + 17) * SPACING_COMPACT
  return Math.max(spanX / Math.max(aspect, 0.42), 46)
}

/**
 * 科普排列侧视图的构图：行星排成一串、太阳在最左，最远的天体刚好落在右边缘。
 *
 * 间距由 visualScale 的分段映射决定（不是等分），所以"该大的大、该小的小"：
 * 内太阳系 9~13 单位一层，火星到木星留出 26 单位的断层。
 */
function atlasShot(width: number, height: number): Shot {
  const aspect = Math.max(width, 1) / Math.max(height, 1)
  /**
   * 左右各留出标签的余地（v6 §1）：太阳的视觉半径涨到 7.5、行星间距也放宽之后，
   * 左侧的 SOHO / PARKER SOLAR PROBE 与右侧的 PLUTO / 旅行者标签会被切掉，
   * 所以把两个边距一起放宽。
   */
  /**
   * **固定取景**（用户 2026-09-25）：侧视 ⇄ 三维只让轨道伸缩，镜头一律不动。
   *
   * 取景按**紧凑档**定死（也就是侧视里的构图，太阳在最左、冥王星轨道贴近右缘）。
   * 切到三维时轨道往外拉长，外圈会直接伸出画面——这正是"直接拉长轨道"的观感；
   * 相反如果让镜头跟着把整条系统装回来，就会出现一缩一放，用户明确否掉了。
   * 想看全的时候用滚轮自己缩（滚轮依旧是用户的手动缩放）。
   */
  const minX = -17 * SPACING_COMPACT
  const maxX = (ATLAS_OUTER_RADIUS + 20) * SPACING_COMPACT
  const spanX = maxX - minX
  /**
   * 宽高比下限 0.6 是给"横屏偏窄"的窗口用的；手机竖屏只有 0.46，
   * 一旦按下限算就会出现"宽度不够装下整段跨度"——真机上表现为
   * 左端的太阳与右端的冥王星被切出画面。下限放到 0.42，
   * 手机竖屏就用它真实的宽高比取景：整张图谱完整落进屏幕。
   * 桌面 / 平板的宽高比都远大于下限，数值不受影响。
   */
  const visibleHeight = Math.max(spanX / Math.max(aspect, 0.42), 46)
  return {
    target: new THREE.Vector3((minX + maxX) / 2, 0, 0),
    height: visibleHeight,
    yaw: SIDE_VIEW_YAW,
    pitch: SIDE_VIEW_PITCH,
  }
}

/**
 * 开场构图（v7.2）。
 *
 * 它不是"另一套背景"，而是**图谱构图的一次等比拉近**：target 与 height 同时
 * 乘同一个系数，于是画面里每个天体的屏幕位置都不变，只是尺度变大——
 * 太阳还是那颗真太阳、还是落在同一个位置，只是近到看不见外太阳系。
 * 点"进入图谱"时相机从这个构图连续拉远到 atlasShot，
 * 观感就是"我从刚才那片宇宙里退出来"，而不是换了一个网页。
 */
/**
 * 俯视全景（v8 §6）：从黄道面上方俯视整圈太阳系。
 *
 * 与 atlasShot 的差别只有两处：target 回到太阳（0,0,0）、pitch 抬到 81°。
 * 行星的**位置**不在这里决定——它们由 REAL 位置模式给出当前 epoch 的真实日心黄经，
 * 所以这一帧就是"此刻真实的太阳系俯视图"，而不是一套摆出来的示意圆。
 */
const TOP_PITCH = 1.42

function topShot(width: number, height: number): Shot {
  const aspect = Math.max(width, 1) / Math.max(height, 1)
  /**
   * 开场（主页）与图谱用**同一档紧凑尺度**（用户 2026-09-25）：
   * 以前主页固定按真实间距取景，点"进入图谱"之后才开始收——看起来就是
   * "先在左边、然后才放大"。现在两处同倍率，进场不再有第二次缩放。
   */
  const diameter = ATLAS_OUTER_RADIUS * 2 * 1.12 * spacingScale()
  const visibleHeight = diameter * Math.max(1, 1 / Math.max(aspect, 0.42))
  return {
    target: new THREE.Vector3(0, 0, 0),
    height: visibleHeight,
    yaw: SIDE_VIEW_YAW,
    pitch: TOP_PITCH,
  }
}

/**
 * 「当前真实位置」的构图（用户 2026-09-25 定版）。
 *
 * **与侧视 / 三维完全同一套取景**：镜头一动不动——不回到太阳、不抬俯仰、不变焦，
 * 只把行星换成此刻真实的日心黄经。画面里"太阳在哪、行星在哪"都由数据决定，
 * 相机不做任何补偿；外圈跑出画面就靠滚轮自己缩（滚轮始终是用户的手动缩放）。
 */
function realPositionShot(width: number, height: number): Shot {
  return atlasShot(width, height)
}

/**
 * 总览构图的分发（V1 §06）。
 *
 * 桌面 / iPad / 手机横屏 —— 侧视信息图，也就是原来的 atlasShot，一字未改。
 * 手机竖屏 —— 同样是侧视信息图：V1.1 一度把它换成过俯视全景，
 * 但真机反馈是"打开完全不知道是什么、也没有侧视图"，所以退回侧视图。
 * 竖屏下轨道 LOD 另有补偿（见 utils/reveal.ts 的 lodGain），
 * 让行星轨道环在竖屏取景下仍然看得见。
 */
function atlasBaseShot(width: number, height: number): Shot {
  /**
   * 真实位置模式下构图由 realPositionShot 决定，这里必须跟着走，
   * 否则"进场镜头"与"进场之后每帧的取景"会是两张图。
   */
  if (useAtlasStore.getState().positionMode === 'REAL') return realPositionShot(width, height)
  return atlasShot(width, height)
}

const scratchDir = new THREE.Vector3()
 
/** 屏幕右方向（独立副本，避免和 scratch 互相覆盖） */
function rightVector(yaw: number): THREE.Vector3 {
  return new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize()
}

/**
 * 聚焦取景锚点（v5 §9）：对象固定在画面左侧约 32% 宽处，右侧留给详情面板。
 * 行星 / 卫星 / 航天器 / 太阳都用同一个规则，不再出现"对象被推到右边"。
 */
const SUBJECT_SCREEN_X = -0.34

/**
 * 被摄天体在画面里的落点（V1 §05 / §06 / §13）。
 *
 *   桌面 / iPad 横屏 —— 左景右档：天体落在左侧 22~34%，右边留给档案（沿用 v5 §9）
 *   iPad 竖屏       —— 上下分区：天体居中并上抬，下半屏是详情
 *   手机            —— 全屏场景 + Bottom Sheet：天体居中并上抬到抽屉上方
 *
 * 单位是"半屏比例"（x 为半宽、y 为半高）。桌面档位必须与 V1 之前的 -0.34 完全一致。
 */
function subjectScreenOffset(): { x: number; y: number } {
  switch (getLayoutMode()) {
    case 'desktop':
      return { x: SUBJECT_SCREEN_X, y: 0 }
    case 'tablet-landscape':
      return { x: -0.24, y: 0 }
    case 'tablet-portrait':
      return { x: -0.02, y: 0.28 }
    // 手机横屏仍然是左景右档（§07），天体留在左侧
    case 'mobile-landscape':
      return { x: -0.2, y: 0.05 }
    default:
      return { x: 0, y: 0.34 }
  }
}

/**
 * 相机的屏幕竖直方向（world up 在垂直于视线平面上的投影）。
 * 竖屏 / 手机需要把天体整体上抬，这一步必须用真实的相机基向量算，
 * 否则天体在倾斜视角下会跑到画面角落。
 */
function upVector(yaw: number, pitch: number, out = new THREE.Vector3()): THREE.Vector3 {
  const dir = scratchDir
    .set(Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw))
    .normalize()
  return out.set(0, 1, 0).addScaledVector(dir, -dir.y).normalize()
}

/**
 * 行星本体占视口高度的比例（v8 §25 的取景判据）。
 * 桌面保持 0.48 不变；竖屏 0.52；手机 0.42（上半屏可见区域里天体约 7 成高）。
 */
function planetScreenFraction(): number {
  switch (getLayoutMode()) {
    case 'desktop':
      return 0.48
    case 'tablet-landscape':
      return 0.46
    case 'tablet-portrait':
      return 0.52
    default:
      return 0.42
  }
}

/** 把天体的世界坐标换算成"落在画面左侧"的相机 target */
function focusTarget(
  anchorPosition: THREE.Vector3,
  height: number,
  aspect: number,
  yaw: number,
  out = new THREE.Vector3(),
  pitch = SIDE_VIEW_PITCH
): THREE.Vector3 {
  const offset = subjectScreenOffset()
  const halfW = (height / 2) * aspect
  out.copy(anchorPosition).addScaledVector(rightVector(yaw), -offset.x * halfW)
  // 桌面 offset.y === 0：这一句在桌面上是彻底的 no-op
  if (offset.y !== 0) out.addScaledVector(upVector(yaw, pitch), -offset.y * (height / 2))
  return out
}

interface LiveAnchor {
  position: THREE.Vector3
  parent: THREE.Vector3
  diskRadius: number
  parentRadius: number
}

/** 被选中对象此刻的世界坐标（月球、航天器都在动，所以必须每帧重取） */
function liveAnchor(kind: FocusKind, id: string | null, t: number): LiveAnchor | null {
  if (!id) return null
  const world = getWorld(t)
  const origin = new THREE.Vector3(0, 0, 0)

  if (kind === 'COMET') {
    const comet = COMET_BY_ID.get(id)
    if (!comet) return null
    const position = cometDisplayPosition(comet, smoothYear())
    return { position, parent: origin, diskRadius: 12, parentRadius: 6 }
  }

  if (kind === 'REGION') {
    const region = world.layout.regions.find((entry) => entry.id === id)
    if (!region) return null
    // 三条带按紧凑尺度整体缩放，聚焦取景必须用同一个倍率
    const spacing = spacingScale()
    return {
      position: region.center.clone(),
      parent: origin,
      diskRadius: region.radius * 2.1 * spacing,
      parentRadius: region.radius * spacing,
    }
  }

  if (kind === 'PLANET') {
    const planet: PlanetDef | undefined = PLANET_BY_ID.get(id as SystemId)
    const anchor = world.planets.get(id as SystemId)
    if (!planet || !anchor) {
      // 太阳不是"行星"，但它同样可以被聚焦（?body=sun 这样的入口）
      const disk = world.systems.get(id as SystemId)
      if (!disk) return null
      /**
       * 月球这类"只有系统盘、没有 PlanetDef"的天体：
       * 本体半径必须取**天体本身**的视觉半径，而不是系统盘半径——
       * 盘的半径是 1.6、月球本体只有 0.26，拿 1.6 当行星去取景，
       * 结果就是"点了月球却只看到一个小点"（v8 §25）。
       */
      const moonAnchor = world.moons.get(id as never)
      const bodyRadius = id === 'sun' ? SUN_RADIUS : moonAnchor?.def?.radius ?? disk.radius * 0.72
      return {
        position: disk.center,
        parent: origin,
        diskRadius: disk.radius,
        parentRadius: bodyRadius,
      }
    }
    return {
      position: anchor.position,
      parent: origin,
      diskRadius: DISK_RADIUS[planet.id] ?? planet.radius + 2.5,
      parentRadius: planet.radius,
    }
  }

  if (kind === 'MOON') {
    const moon = world.moons.get(id)
    if (!moon) return null
    const planet = world.planets.get(moon.planetId)
    return {
      position: moon.position,
      parent: planet?.position ?? origin,
      diskRadius: DISK_RADIUS.moon,
      parentRadius: planet?.planet.radius ?? 1,
    }
  }

  const anchor = world.objects.get(id)
  if (!anchor) return null
  const planet = PLANET_BY_ID.get(anchor.object.system as SystemId)
  return {
    position: anchor.position,
    parent: anchor.parent,
    diskRadius: DISK_RADIUS[anchor.object.system] ?? 12,
    parentRadius: planet?.radius ?? 1,
  }
}

/**
 * 聚焦取景。三个层级各有自己的构图逻辑：
 *   行星 —— 整张卫星轨道盘收进画面，target 就是行星本体
 *   月球 —— 同时看到月球与它自己的小盘
 *   航天器 —— 落在画面左侧 1/3，母体行星推到右侧，中间是它的轨道
 */
function computeFocusShot(kind: FocusKind, anchor: LiveAnchor, aspect: number): Shot | null {
  if (kind === 'COMET') {
    const height = 26
    const yaw = SIDE_VIEW_YAW + 0.34
    const pitch = 0.28
    return {
      target: focusTarget(anchor.position, height, aspect, yaw, new THREE.Vector3(), pitch),
      height,
      yaw,
      pitch,
    }
  }

  if (kind === 'REGION') {
    // 三圈结构：从黄道面上方一点俯视，让整圈刚好落进画面
    const height = anchor.diskRadius * 2.1
    const yaw = SIDE_VIEW_YAW + 0.1
    const pitch = 0.62
    return {
      target: focusTarget(anchor.position, height, aspect, yaw, new THREE.Vector3(), pitch),
      height,
      yaw,
      pitch,
    }
  }

	  if (kind === 'PLANET') {
	    /**
	     * v8 §25：行星必须是左侧的 hero object。
	     *
	     * 取景的判据不再是"整张卫星盘收进画面"（那样地球只有 ~50px 高），
	     * 而是**行星本体的视直径 ≈ 视口高度的 0.48**：
	     *   height = 本体直径 / 0.48
	     * 卫星同心圆因此会超出画面——它们改由右侧档案与全息标注说明，
	     * 这也是 v8 "行星表面全息分析"的前提。
	     */
	    /**
	     * V1 §13：手机 / 竖屏下场景区域更小，天体本体要占更大的比例
	     * （桌面 0.48，竖屏 0.52，手机 0.42——手机还要给底部抽屉留出可见上半屏）。
	     */
	    const PLANET_SCREEN_FRACTION = planetScreenFraction()
	    const diameter = anchor.parentRadius * 2
	    // 下限 1.4：再近就会撞进天体表面（月球本体只有 0.26 个视觉单位）
	    const availableFraction = isTouchLayout(getLayoutMode()) ? PLANET_SCREEN_FRACTION : Math.min(PLANET_SCREEN_FRACTION, Math.max(0.22, aspect * 0.42))
	    const height = Math.max(diameter / availableFraction, 1.4)
    /**
     * 推近行星时，镜头必须**几乎正对系统盘的法线**（只留 5° 左右的偏角）。
     * 旧版给了 +0.26 / 0.34，比盘面多转出 15° 以上，于是俯视一点点，
     * 好不容易画成正圆的同心圆又被压成椭圆（v6 §2）。
     */
    const yaw = SIDE_VIEW_YAW + 0.08
    const pitch = SIDE_VIEW_PITCH + 0.09
    return {
      target: focusTarget(anchor.position, height, aspect, yaw, new THREE.Vector3(), pitch),
      height,
      yaw,
      pitch,
    }
  }

  if (kind === 'MOON') {
    /**
     * v8 §25：月球同样是 hero object。
     * 旧版上下界都在 diskRadius*3.1 ≈ 5 附近，月球只有 ~80px；
     * 现在按"本体占视高 1/3"取景，并把上限收到 2.6，
     * 剩下的空间留给全息地貌标注（月海 / 撞击坑）。
     */
    const height = THREE.MathUtils.clamp(Math.max((anchor.parentRadius * 2) / 0.45, 1.5), 1.5, 2.6)
    const yaw = SIDE_VIEW_YAW + 0.08
    const pitch = SIDE_VIEW_PITCH + 0.09
    return {
      target: focusTarget(anchor.position, height, aspect, yaw, new THREE.Vector3(), pitch),
      height,
      yaw,
      pitch,
    }
  }

  const toParent = new THREE.Vector3().subVectors(anchor.parent, anchor.position)
  const distance = toParent.length()
  let yaw = SIDE_VIEW_YAW + 0.2
  if (distance > 1e-4) {
    // 把母体行星放到屏幕 +x 方向：right = (cos yaw, 0, -sin yaw)
    yaw = Math.atan2(-toParent.z, toParent.x) - 0.55
  }

  // 画面高度同时容下"对象自己的轨道"和"母体行星正好在右侧"
  const height = THREE.MathUtils.clamp(
    Math.max(anchor.diskRadius * 1.9, distance * 1.5, anchor.parentRadius * 8),
    1.6,
    anchor.diskRadius * 3
  )

  // 对象落在画面 32% 宽处：偏移直接算进取景目标，所以飞过去就已经在左边，
  // 而不是先飞到中间再滑开（那是"所有东西都在右边"的根源）。
  const pitch = 0.22
  return {
    target: focusTarget(anchor.position, height, aspect, yaw, new THREE.Vector3(), pitch),
    height,
    yaw,
    pitch,
  }
}

export function CameraRig() {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera
  const gl = useThree((state) => state.gl)
  const size = useThree((state) => state.size)

  const home = useRef<Shot>({
    target: new THREE.Vector3(54, 0, 0),
    height: 88,
    yaw: SIDE_VIEW_YAW,
    pitch: SIDE_VIEW_PITCH,
  })
  const current = useRef<Shot>(cloneShot(home.current))
  const desired = useRef<Shot>(cloneShot(home.current))
  const manualOffset = useRef(new THREE.Vector3())
  /**
   * 用户是否已经自己转过视角（v7 §1）。
   * 一旦转过，任何"回到基准朝向"的逻辑都必须让位——右键松手绝不能触发 reset。
   * 只有 HOME / 回到侧视排列才会清掉它。
   */
  const manualOrbit = useRef(false)
  /**
   * v8.2：首页（俯视全景）的交互量。
   * 指针位置给一点视差，拖动可以真正转起来，滚轮能拉近拉远——
   * 这样"进站第一屏"不是一张静态图。
   */
  const introDrag = useRef({ yaw: 0, pitch: 0 })
  const introZoom = useRef(1)
  /** v8 自检：订阅命中次数 / syncInitial 命中次数（?debug=1 时可见） */
  const debugSubs = useRef({ fired: 0, focus: 0, sync: 0 })
  const flight = useRef<Flight | null>(null)
  /**
   * Side → 3D 的相机过渡（v5 §5）。
   * 轨道解构动画有 1.85s，相机不能瞬间换角度，否则观众看到的是"一次闪动"。
   * 这里让相机与轨道同步走完同一段时间；用户一开始拖拽就交还控制权。
   */
  const transition = useRef<{
    fromYaw: number
    fromPitch: number
    fromHeight: number
    fromX: number
    fromZ: number
    toYaw: number
    toPitch: number
    toHeight: number
    toX: number
    toZ: number
    elapsed: number
    duration: number
  } | null>(null)
  const drag = useRef({ active: false, moved: false, x: 0, y: 0, button: 0, orbiting: false })
  const pointer = useRef({ x: 0, y: 0 })
  /** 用户自己缩放过之后，就不再让总览的自动构图覆盖他的尺度 */
  const manualZoom = useRef(false)
  /** 紧凑尺度是否已经和首帧的排列对齐（对齐之后才开始播放收放动画） */
  const spacingReady = useRef(false)
  /**
   * V1：触摸手势是否正在作用（单指旋转 / 双指缩放）。
   *
   * 桌面端恒为 false——只有 GestureManager 会在手指按下时置位，
   * 所以下面所有 `&& !touchDrag.current` 的判断在桌面上等价于不写，
   * 每帧构图逻辑与 V1 之前完全一致。
   */
  const touchDrag = useRef(false)
  /** 本次触摸是否已经触发过"侧视 → 3D 展开" */
  const touchOrbitArmed = useRef(false)
  /**
   * V1.1 修复：手指转过视角之后，**不许**再被"聚焦构图"拉回原角度。
   *
   * 真机反馈"聚焦之后没法转动视角"，根因就在这里：
   * 聚焦状态下每帧都会把 desired.yaw/pitch 强制设回 computeFocusShot 的角度，
   * 桌面靠 drag.current.moved 把这条盖住（鼠标拖过就一直为 true），
   * 而触摸路径没有对应的闩锁——于是手指一松开，视角立刻弹回。
   * 这个闩锁只由触摸手势置位，桌面端恒为 false，桌面行为不变。
   */
  const touchManualOrbit = useRef(false)

  useEffect(() => {
    home.current = atlasBaseShot(size.width, size.height)
    manualZoom.current = false
  }, [size.width, size.height])

  /**
   * 自检钩子：`?debug=1` 时把镜头状态挂到 `window.__atlasCamera()`。
   * tools/drag-test.ps1 用它验证"左键拖动是不是真的留在原地"——
   * 这类交互只能靠跑起来量，不能靠看代码。
   */
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('debug') !== '1') return
    ;(window as unknown as { __atlasCamera?: () => unknown }).__atlasCamera = () => ({
      x: current.current.target.x,
      y: current.current.target.y,
      z: current.current.target.z,
      height: current.current.height,
      yaw: current.current.yaw,
      pitch: current.current.pitch,
      offset: [manualOffset.current.x, manualOffset.current.y, manualOffset.current.z],
      // v8 自检：镜头正在做什么（飞行 / 过渡 / 静止）
      flight: flight.current ? flight.current.kind : null,
      transition: transition.current ? 'yes' : 'no',
      // v9.1 自检：平滑年份与地球的世界坐标（验证时间轴是否连续驱动位置）
      year: smoothYear(),
      earth: (() => {
        const anchor = getWorld(worldNow()).planets.get('earth' as never)
        return anchor ? [anchor.position.x, anchor.position.z] : null
      })(),
      // v9.2 自检：各行星当前的压暗系数（聚焦时其他天体应为 0.05–0.14）
      dims: Object.fromEntries(
        Array.from(planetDim.entries()).map(([id, value]) => [id, Math.round(value * 100) / 100])
      ),
      debug: { ...debugSubs.current },
    })
  }, [])

  // 深链 ?view=orbit3d：直接落在"已经进入 3D"的倾角上（自检截图用）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const state = useAtlasStore.getState()
    const deepLinkReal = params.get('position') === 'real' || state.positionMode === 'REAL'
    if (params.get('view') === 'orbit3d' || deepLinkReal) {
      state.setView('ORBIT3D')
      state.setAtlasPose(false)
      requestOrbitPose(1)
      const shot = deepLinkReal
        ? realPositionShot(size.width, size.height)
        : atlasBaseShot(size.width, size.height)
      if (!deepLinkReal) {
        shot.pitch = 0.52
        shot.yaw = SIDE_VIEW_YAW + 0.22
        shot.height *= 1.25
      }
      // 深链直接落在正确构图上，不要从前一版构图慢慢漂过来
      manualZoom.current = false
      home.current = shot
      current.current = cloneShot(shot)
      desired.current = cloneShot(shot)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const element = gl.domElement
    const halfHeight = () => current.current.height / 2
    /**
     * 这台设备是不是"以触屏为主"（V1 §02）。
     *
     * false = 桌面 / 触屏笔记本：触摸仍然走 V1 之前的老路径（拖动 = 平移），
     * 一个新分支都不会被走到。
     */
    const touchGestures = isTouchLayout(getLayoutMode())

    const onWheel = (event: WheelEvent) => {
      /**
       * 首页也能缩放（v8.2）：滚轮在开场状态只改俯视全景的取景远近，
       * 范围夹在 0.75–1.35 之间，不至于把太阳系拉出画面。
       */
      if (useAtlasStore.getState().mode === 'INTRO') {
        event.preventDefault()
        introZoom.current = THREE.MathUtils.clamp(
          introZoom.current * Math.exp(event.deltaY * 0.0009),
          0.75,
          1.35
        )
        return
      }
      event.preventDefault()
      flight.current = null
      manualZoom.current = true
      // v8：上限提到 760。奥尔特云的粒子壳外缘在 340 左右，
      // 必须能一次装下整层壳，"拉到最远"才看得出它包住整个太阳系。
      // v9：整体轨道放大两倍，壳外缘跟着到 690 左右，上限同步翻倍。
      desired.current.height = THREE.MathUtils.clamp(
        desired.current.height * Math.exp(THREE.MathUtils.clamp(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.height : 1), -180, 180) * 0.0011),
        1.5,
        1520
      )
    }

    const onPointerDown = (event: PointerEvent) => {
      // 触屏设备：指针交给 GestureManager 统一识别，这里不再重复处理
      if (event.pointerType !== 'mouse' && touchGestures) return
      useExperience.setState({ orbit: false })
      // 中键：浏览器默认会用来自动滚动，必须挡掉
      if (event.button === 1) event.preventDefault()
      const orbiting = event.button === 2 || event.shiftKey || useExperience.getState().rotate
      drag.current = {
        active: true,
        moved: false,
        x: event.clientX,
        y: event.clientY,
        button: event.button,
        orbiting,
      }
      element.setPointerCapture?.(event.pointerId)
      // v8 §21：右键转视角全程无声——拖动期间连 hover 音一起掐掉
      audio.muteHover(true)
      // 右键开始转动视角 → 进入 ORBIT_3D：轨道从"正对镜头"展开成真实 3D 姿态，
      // 而且这个状态**不会**在松开右键时退回侧视图（方案书 §3）。
      if (orbiting && useAtlasStore.getState().mode !== 'INTRO') {
        const state = useAtlasStore.getState()
        if (state.view === 'SIDE' && state.focusKind === 'ATLAS') {
          const target = atlasBaseShot(size.width, size.height)
          transition.current = {
            fromYaw: current.current.yaw,
            fromPitch: current.current.pitch,
            fromHeight: current.current.height,
            fromX: current.current.target.x,
            fromZ: current.current.target.z,
            toYaw: SIDE_VIEW_YAW + 0.3,
            toPitch: 0.3,
            toHeight: target.height * 1.04,
            toX: target.target.x,
            toZ: target.target.z,
            elapsed: 0,
            duration: UNFOLD_DURATION,
          }
        }
        state.setView('ORBIT3D')
        requestOrbitPose(1)
        state.setAtlasPose(false)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / size.width) * 2 - 1
      pointer.current.y = -((event.clientY / size.height) * 2 - 1)
      if (!drag.current.active) return
      const dx = event.clientX - drag.current.x
      const dy = event.clientY - drag.current.y
      if (Math.abs(dx) + Math.abs(dy) > 3) {
        drag.current.moved = true
        if(useExperience.getState().observation)useExperience.setState({observation:null})
      }
      drag.current.x = event.clientX
      drag.current.y = event.clientY
      /**
       * 首页：拖动直接转俯视全景（v8.2）。
       * 这里不能 continue 到下面的 3D 展开逻辑——开场还没有"轨道姿态"这回事，
       * 只把它当成一次轻量的视角旋转。
       */
      if (useAtlasStore.getState().mode === 'INTRO') {
        introDrag.current.yaw = THREE.MathUtils.clamp(
          introDrag.current.yaw - dx * 0.0035,
          -0.85,
          0.85
        )
        introDrag.current.pitch = THREE.MathUtils.clamp(
          introDrag.current.pitch - dy * 0.0026,
          -0.16,
          0.16
        )
        return
      }
      if (useAtlasStore.getState().mode === 'INTRO') return
      flight.current = null

      if (drag.current.button === 1) {
        // 中键拖拽 = dolly：向上拉近，向下推远（和滚轮同一个自由度）
        manualZoom.current = true
        // 飞行途中缩放会同时收到"飞行插值"和"用户 dolly"两种指令 → 画面抽搐，
        // 所以中键一按下就取消正在进行的飞行（v5 §14）。
        flight.current = null
        desired.current.height = THREE.MathUtils.clamp(
          desired.current.height * Math.exp(dy * 0.004),
          1.5,
          760
        )
      } else if (drag.current.orbiting || drag.current.button === 2) {
        // 用户开始自己转视角：相机过渡立刻让位
        transition.current = null
        manualOrbit.current = true
        // 俯仰只由拖拽改变，且被夹在真实范围内；不再由指针位置逐帧累加
        desired.current.yaw -= dx * 0.0016
        desired.current.pitch = THREE.MathUtils.clamp(
          desired.current.pitch + dy * 0.0022,
          -1.35,
          1.35
        )
      } else {
        const scale = (halfHeight() * 2) / Math.max(size.height, 1)
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
        manualOffset.current.addScaledVector(right, -dx * scale)
        manualOffset.current.addScaledVector(up, dy * scale)
      }
    }

    const onPointerUp = (event: PointerEvent) => {
      // 触摸指针由 GestureManager 管理 capture，这里绝不能替它释放
      if (event.pointerType !== 'mouse' && touchGestures) return
      drag.current.active = false
      // 拖动结束，恢复 hover 音（v8 §21）
      audio.muteHover(false)
      element.releasePointerCapture?.(event.pointerId)
    }
    const onContext = (event: MouseEvent) => event.preventDefault()
    /**
     * 双击空白处 = 回到基准构图（v6 §12）。
     * 左键平移现在是**真的会留在原地**的，所以需要一个把图谱拉回正中的出口：
     * 清掉手动偏移与手动缩放，让阻尼把镜头缓缓带回 home 构图（不是硬跳）。
     */
    const onDoubleClick = () => {
      if (useAtlasStore.getState().mode === 'INTRO') return
      window.dispatchEvent(new CustomEvent('atlas-camera', { detail: 'reset' }))
    }
    // 中键在浏览器里默认会触发自动滚动：这里显式挡掉，中键才是纯粹的 dolly
    const onMouseDown = (event: MouseEvent) => {
      if (event.button === 1) event.preventDefault()
    }

    const onCommand = (event: Event) => {
      const action = (event as CustomEvent<string>).detail
      flight.current = null
      transition.current = null
      if (['day','terminator','night'].includes(action)) {
        const state=useAtlasStore.getState()
        const anchor=liveAnchor(state.focusKind,state.focusId,worldNow())
        if(!anchor || state.focusId==='sun')return
        const towardSun=anchor.position.clone().negate().normalize()
        if(action==='night')towardSun.negate()
        if(action==='terminator') {
          const tangent = new THREE.Vector3(0,1,0).cross(towardSun)
          if(tangent.lengthSq()<1e-6)tangent.set(1,0,0).cross(towardSun)
          towardSun.copy(tangent.normalize())
        }
        useExperience.setState({observation:action as 'day'|'terminator'|'night',orbit:false})
        const yaw=Math.atan2(towardSun.x,towardSun.z)
        desired.current.yaw=current.current.yaw+Math.atan2(Math.sin(yaw-current.current.yaw),Math.cos(yaw-current.current.yaw))
        desired.current.pitch=Math.asin(THREE.MathUtils.clamp(towardSun.y,-.98,.98))
        manualOrbit.current=true
        manualOffset.current.set(0,0,0)
      } else if (action === 'reset') {
        useExperience.setState({observation:null,orbit:false})
        manualOffset.current.set(0, 0, 0)
        manualZoom.current = false
        manualOrbit.current = false
        desired.current = cloneShot(home.current)
      } else if (action === 'in' || action === 'out') {
        manualZoom.current = true
        desired.current.height = THREE.MathUtils.clamp(desired.current.height * (action === 'in' ? 0.8 : 1.25), 1.5, 760)
      }
    }
    window.addEventListener('atlas-camera', onCommand)
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('pointerdown', onPointerDown)
    element.addEventListener('mousedown', onMouseDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    element.addEventListener('contextmenu', onContext)
    element.addEventListener('dblclick', onDoubleClick)
    /**
     * ---------------------------- 触摸手势（V1 §09 / §11） ----------------------------
     *
     *   单指拖动 → Rotate        双指 pinch → Zoom
     *   双指平移 → Pan           轻点     → Select / Focus（交给 R3F 的 click）
     *
     * 四条手势最终都作用在**同一份** desired / manualOffset 上，
     * 和滚轮、中键 dolly、右键旋转共用一套阻尼与夹值——
     * 没有第二套 Camera 逻辑（方案书 §12）。
     */
    const stopTouchDrag = () => {
      touchDrag.current = false
      touchOrbitArmed.current = false
    }

    /** 手指第一次真正转动时：进入 3D（与桌面右键按下时的那一段完全同义） */
    const armTouchOrbit = () => {
      if (touchOrbitArmed.current) return
      useExperience.setState({observation:null,orbit:false})
      touchOrbitArmed.current = true
      touchDrag.current = true
      const state = useAtlasStore.getState()
      if (state.mode === 'INTRO') return
      flight.current = null
      manualOrbit.current = true
      if (state.view === 'SIDE' && state.focusKind === 'ATLAS') {
        const target = atlasBaseShot(size.width, size.height)
        transition.current = {
          fromYaw: current.current.yaw,
          fromPitch: current.current.pitch,
          fromHeight: current.current.height,
          fromX: current.current.target.x,
          fromZ: current.current.target.z,
          toYaw: SIDE_VIEW_YAW + 0.3,
          toPitch: 0.3,
          toHeight: target.height * 1.04,
          toX: target.target.x,
          toZ: target.target.z,
          elapsed: 0,
          duration: UNFOLD_DURATION,
        }
      }
      state.setView('ORBIT3D')
      requestOrbitPose(1)
      state.setAtlasPose(false)
      touchManualOrbit.current = true
    }

    const detachGestures = gestureManager.registerCanvas(element, {
      onOrbitStart: () => {
        touchDrag.current = true
      },
      onOrbit: (yawDelta, pitchDelta) => {
        armTouchOrbit()
        if (useAtlasStore.getState().mode === 'INTRO') {
          // 首页：只做一次轻量的视角旋转（与桌面拖动首页同义）
          introDrag.current.yaw = THREE.MathUtils.clamp(
            introDrag.current.yaw + yawDelta,
            -0.85,
            0.85
          )
          introDrag.current.pitch = THREE.MathUtils.clamp(
            introDrag.current.pitch - pitchDelta,
            -0.16,
            0.16
          )
          return
        }
        transition.current = null
        /**
         * 方向必须与桌面右键拖拽完全一致：
         *   桌面  desired.yaw -= dx * 0.0016
         *   触摸  desired.yaw += yawDelta，而 yawDelta = -dx * 0.0016
         * 两者等式相同。V1.1 之前这里写成了 `-=`，于是手指往左拖画面往右走
         * （真机反馈的"拖动逻辑是反的"）。
         */
        desired.current.yaw += yawDelta * 0.5
        desired.current.pitch = THREE.MathUtils.clamp(
          desired.current.pitch + pitchDelta * 0.5,
          -1.35,
          1.35
        )
      },
      onPinch: (scaleDelta) => {
        if (scaleDelta <= 0) return
        touchDrag.current = true
        if (useAtlasStore.getState().mode === 'INTRO') {
          introZoom.current = THREE.MathUtils.clamp(introZoom.current / scaleDelta, 0.75, 1.35)
          return
        }
        flight.current = null
        manualZoom.current = true
        desired.current.height = THREE.MathUtils.clamp(
          desired.current.height / scaleDelta,
          1.5,
          1520
        )
      },
      onPan: (dx, dy) => {
        touchDrag.current = true
        if (useAtlasStore.getState().mode === 'INTRO') return
        flight.current = null
        const scale = (halfHeight() * 2) / Math.max(size.height, 1)
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
        manualOffset.current.addScaledVector(right, -dx * scale)
        manualOffset.current.addScaledVector(up, dy * scale)
      },
      onEnd: stopTouchDrag,
    })
    return () => {
      window.removeEventListener('atlas-camera', onCommand)
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('pointerdown', onPointerDown)
      element.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      element.removeEventListener('contextmenu', onContext)
      element.removeEventListener('dblclick', onDoubleClick)
      detachGestures()
    }
  }, [camera, gl, size.height, size.width])

  const savedViews = useRef(new Map<number, Shot>())
  useEffect(() => {
    const save = (event: Event) => savedViews.current.set((event as CustomEvent<number>).detail, cloneShot(current.current))
    const restore = (event: Event) => {
      const token = (event as CustomEvent<number>).detail
      const shot = savedViews.current.get(token)
      if (!shot) return
      for (const key of savedViews.current.keys()) if (key >= token) savedViews.current.delete(key)
      const s = useAtlasStore.getState()
      const anchor = s.focusKind === 'ATLAS' ? null : liveAnchor(s.focusKind, s.focusId, worldNow())
      const base = anchor ? focusTarget(anchor.position, shot.height, size.width / Math.max(size.height, 1), shot.yaw, new THREE.Vector3(), shot.pitch)
        : atlasBaseShot(size.width, size.height).target
      manualOffset.current.copy(shot.target).sub(base)
      manualZoom.current = true
      manualOrbit.current = true
      touchManualOrbit.current = true
      transition.current = null
      desired.current = cloneShot(shot)
      flight.current = { from: cloneShot(current.current), to: cloneShot(shot), start: performance.now() / 1000, duration: .8, kind: 'out' }
    }
    const clear = () => savedViews.current.clear()
    window.addEventListener('atlas-focus-save', save)
    window.addEventListener('atlas-focus-restore', restore)
    window.addEventListener('atlas-focus-clear', clear)
    return () => {
      window.removeEventListener('atlas-focus-save', save)
      window.removeEventListener('atlas-focus-restore', restore)
      window.removeEventListener('atlas-focus-clear', clear)
    }
  }, [size.width, size.height])

  // ---- 状态机 → 镜头 ----
  useEffect(() => {
    return useAtlasStore.subscribe((state, previous) => {
      debugSubs.current.fired++
      const now = performance.now() / 1000

      if (state.mode === 'ENTERING' && previous.mode !== 'ENTERING') {
        /**
         * 主页 → 图谱的连续过渡（v7.2 §9）。
         *
         * 起点**就是主页那一帧**（introShot）：同一颗太阳、同一批轨道、
         * 同一个星场，相机在 1.4s 里连续拉远到整张图谱。
         * 因为起点和主页完全一致，这里不存在"切换"，
         * 行星 / 外太阳系是从画面边缘自然走进来的，不会闪。
         */
        home.current = atlasBaseShot(size.width, size.height)
        const from = topShot(size.width, size.height)
        current.current = cloneShot(from)
        desired.current = cloneShot(home.current)
        manualOffset.current.set(0, 0, 0)
        manualOrbit.current = false
        touchManualOrbit.current = false
        /**
         * v8 §9 / §11：两段式。
         *
         *   0.00–0.50s  落地 UI 先退场（镜头不动）
         *   0.50–2.70s  俯视 → 侧视的完整过渡（2.2s）
         *
         * 同时把位置从"真实日心黄经"连续拉回侧视图的示意图排列：
         * 圆轨道逐渐压成椭圆、行星从俯视的环形位置滑到那一排水平线上。
         */
        requestPositionPose(0)
        flight.current = {
          from,
          to: cloneShot(home.current),
          start: now + 0.5,
          duration: 2.2,
          kind: 'out',
        }
      }

      const focusChanged = state.focusKind !== previous.focusKind || state.focusId !== previous.focusId
      if (focusChanged) debugSubs.current.focus++
      if (!focusChanged && state.view === 'SIDE' && previous.view !== 'SIDE') {
        manualOrbit.current = false
        touchManualOrbit.current = false
      }

      /**
       * 切换"真实位置"开关时，**镜头一律不动**（用户 2026-09-25）。
       *
       * 旧版在这里造了一段 1.2 秒的镜头过渡，把相机拉到"以太阳为中心"的实时构图上，
       * 于是三维视图里点一下实时位置，镜头就被掰回正侧视（俯仰被插值回 0）。
       * 现在三种排列共用同一套取景，切换只换行星位置，相机不做任何补偿。
       */
      if (state.positionMode !== previous.positionMode) {
        manualOrbit.current = false
        touchManualOrbit.current = false
      }
      if (state.cameraState === 'FLYING_IN' && focusChanged) {
        const anchor = liveAnchor(state.focusKind, state.focusId, worldNow())
        const to = anchor
          ? computeFocusShot(state.focusKind, anchor, size.width / Math.max(size.height, 1))
          : null
        if (to) {
          manualOffset.current.set(0, 0, 0)
          // 换了一个天体 = 重新取景，把"用户自己转过的角度"交还给构图
          touchManualOrbit.current = false
          flight.current = {
            from: cloneShot(current.current),
            to,
            start: now,
            duration: state.focusKind === 'OBJECT' ? 1.15 : 1.0,
            kind: 'in',
          }
        }
      }

      if (state.cameraState === 'RETURNING' && previous.cameraState !== 'RETURNING') {
        manualOffset.current.set(0, 0, 0)
        manualZoom.current = false
        manualOrbit.current = false
        touchManualOrbit.current = false
        desired.current = cloneShot(home.current)
        flight.current = {
          from: cloneShot(current.current),
          to: cloneShot(home.current),
          start: now,
          duration: 0.95,
          kind: 'out',
        }
      }
    })
    /**
     * v8：挂载后先同步一次状态。
     *
     * 深链（?body=earth / ?object=iss）在 320ms 就调用了 focusPlanet，
     * 而 R3F 的 Canvas 在无头 / 慢机器上可能更晚才把 CameraRig 挂起来——
     * 那次 store 变更没有任何订阅者，于是 cameraState 永远是 FLYING_IN、
     * 镜头却停在总览：这正是"点了行星却没推近"的根因。
     * 这里在订阅建立后补一次同样的判断。
     */
    const syncInitial = () => {
      const state = useAtlasStore.getState()
      if (state.cameraState !== 'FLYING_IN' || state.focusKind === 'ATLAS') return
      debugSubs.current.sync++
      const anchor = liveAnchor(state.focusKind, state.focusId, worldNow())
      const shot = anchor
        ? computeFocusShot(state.focusKind, anchor, size.width / Math.max(size.height, 1))
        : null
      if (!shot) return
      flight.current = {
        from: cloneShot(current.current),
        to: shot,
        start: performance.now() / 1000,
        duration: state.focusKind === 'OBJECT' ? 1.15 : 1.0,
        kind: 'in',
      }
    }
    syncInitial()
  }, [size.height, size.width])

  useFrame((state, delta) => {
    if (useExperience.getState().orbit && !flight.current && !drag.current.active) {
      manualOrbit.current = true
      desired.current.yaw += Math.min(delta, 0.05) * 0.025
    }

    const now = performance.now() / 1000
    const active = flight.current

    // 帧步长下限：requestAnimationFrame 偶尔会给出 0（首帧、标签页切回、
    // 无头浏览器的时间快进）。若直接拿去算阻尼，收敛速度会变成 0，镜头永远停在原地。
    const step = THREE.MathUtils.clamp(delta, 1 / 240, 0.05)
    advanceTime(step)
    // v7 §13：时间轴的平滑推进必须早于所有读星历的组件
    advanceYear(step)
    advanceOrbitPose(step)
    advancePositionPose(step)
    /**
     * 紧凑尺度（用户 2026-09-25）：目标由当前排列决定——侧视排列收紧行星间距，
     * 三维 / 实时排列展开。放在这里推进，所有入口（菜单、深链、聚焦、回主页）
     * 都自动跟上，不需要各自通知一次。
     */
    const layoutState = useAtlasStore.getState()
    /**
     * 主页也按同一档尺度（用户 2026-09-25）：
     * 只有"三维 / 实时排列"才展开，其余（含开场）都是紧凑，
     * 于是从主页进图谱不会再有第二次缩放。
     */
    /**
     * 紧凑尺度什么时候生效（用户 2026-09-25 第三轮修正）。
     *
     * 旧条件只看排列：一旦聚焦，排列会切到三维 → 轨道在飞行途中往外胀 →
     * 镜头在追一个还在移动的目标，于是"从主页进来第一次点聚焦会位移"
     * （之后的聚焦已经在三维里，轨道不再变，所以只有第一次看得出来）。
     *
     * 现在把"正在聚焦某个天体 / 任务档案"也算作紧凑：聚焦过程中世界里
     * 没有任何东西在移动，镜头飞过去就是最终构图。回到图谱时再按排列展开或收紧。
     */
    const focused = layoutState.focusKind !== 'ATLAS'
    const compactLayout =
      layoutState.positionMode !== 'REAL' && (layoutState.view === 'SIDE' || focused)
    if (!spacingReady.current) {
      spacingReady.current = true
      snapSpacing(compactLayout)
    } else {
      advanceSpacing(step, compactLayout)
    }

    if (active) {
      const k = THREE.MathUtils.clamp((now - active.start) / active.duration, 0, 1)
      const e = easeInOutCubic(k)
      /**
       * 飞行目标要**实时重算**（用户 2026-09-25：侧视里聚焦行星会先跑偏再回来）。
       *
       * 聚焦会把排列切到三维，紧凑尺度随之展开——行星在世界里往外走。
       * 如果沿用起飞那一刻抓下来的坐标，镜头就飞向一个已经空掉的位置，
       * 落地后每帧的跟随逻辑再把它拽回行星身边，看起来就是"先跑偏再回来"。
       * 这里在飞行途中持续用当帧的行星位置刷新目标，镜头直接飞向当前真实位置。
       */
      if (active.kind === 'in') {
        const focusState = useAtlasStore.getState()
        const live = liveAnchor(focusState.focusKind, focusState.focusId, worldNow())
        const flightAspect = size.width / Math.max(size.height, 1)
        const next = live ? computeFocusShot(focusState.focusKind, live, flightAspect) : null
        if (next) active.to = next
      }
      current.current.target.lerpVectors(active.from.target, active.to.target, e)
      current.current.height = THREE.MathUtils.lerp(active.from.height, active.to.height, e)
      current.current.yaw = THREE.MathUtils.lerp(active.from.yaw, active.to.yaw, e)
      current.current.pitch = THREE.MathUtils.lerp(active.from.pitch, active.to.pitch, e)
      desired.current = cloneShot(current.current)
      // 揭示度跟镜头同步（v7.2）：拉远的进度就是"宇宙展开"的进度
      if (active.kind === 'out' && useAtlasStore.getState().mode === 'ENTERING') {
        sceneReveal.value = e
      }
      if (k >= 1) {
        flight.current = null
        if (active.kind === 'in') {
          useAtlasStore.getState().setCameraState('FOCUS')
          if (useAtlasStore.getState().focusKind === 'OBJECT') useAtlasStore.getState().openArchive()
        } else {
          useAtlasStore.getState().setCameraState('FREE')
          if (useAtlasStore.getState().mode === 'ENTERING') {
            sceneReveal.value = 1
            useAtlasStore.getState().setMode('ATLAS')
          }
        }
      }
    } else if (useAtlasStore.getState().mode === 'INTRO') {
      /**
       * 开场（v7.2）：相机停在**图谱构图的等比拉近**上。
       *
       * 这一帧看到的就是真实的太阳、真实的轨道、真实的行星——
       * 主页背景不再是另一套装饰，所以进入时没有可"切"的东西。
       * 同时因为行星就在这一帧被渲染，它们的贴图在开场阶段就完成了上传，
       * 点"进入图谱"不会再有第一次贴图上传造成的卡顿。
       */
      sceneReveal.value = 0
      /**
       * 开场 = 真实位置的俯视全景（v8 §5 / §6）。
       *
       * 位置用 REAL（当前 epoch 的真实日心黄经），姿态用平的黄道面
       * （orbitPose = 0），相机抬到 81° 俯视——于是各条轨道读成正圆，
       * 行星落在它们此刻真正所在的方向上。
       */
      setOrbitPoseImmediate(0)
      setPositionPoseImmediate(1)
      /**
       * 首页是可交互的（v8.2）：指针位置给一点视差、拖动真的能转、
       * 滚轮能拉近拉远。所以这里不是死板地钉在 topShot 上，
       * 而是把用户量叠加上去，再让阻尼（下面的 lerp）把它抚平。
       */
      const base = topShot(size.width, size.height)
      const target: Shot = {
        target: base.target.clone(),
        height: base.height * introZoom.current,
        yaw: base.yaw + introDrag.current.yaw + pointer.current.x * 0.09,
        pitch: THREE.MathUtils.clamp(
          base.pitch + introDrag.current.pitch - pointer.current.y * 0.05,
          1.05,
          1.55
        ),
      }
      home.current = target
      const damp = 0.09
      current.current.target.lerp(target.target, damp)
      current.current.height += (target.height - current.current.height) * damp
      current.current.yaw += (target.yaw - current.current.yaw) * damp
      current.current.pitch += (target.pitch - current.current.pitch) * damp
      desired.current = cloneShot(current.current)
    } else {
      sceneReveal.value = 1
      const { focusKind, focusId } = useAtlasStore.getState()
      const anchor = focusKind === 'ATLAS' ? null : liveAnchor(focusKind, focusId, worldNow())
      const aspect = size.width / Math.max(size.height, 1)
      const shot = anchor ? computeFocusShot(focusKind, anchor, aspect) : null
      const following = Boolean(anchor && shot)

      /**
       * v8：自愈。
       *
       * store 里写着"正在飞过来"，但实际没有飞行——这种情况真的会发生：
       * 深链（?body=earth）在 320ms 改状态，而 Canvas / CameraRig 在慢机器
       * 或无头环境里可能更晚才挂起来，那次事件没有任何订阅者，
       * 于是镜头永远停在总览。这里每帧检查一次，发现就补上这次飞行。
       */
      if (following && shot && useAtlasStore.getState().cameraState === 'FLYING_IN') {
        touchManualOrbit.current = false
        flight.current = {
          from: cloneShot(current.current),
          to: shot,
          start: now,
          duration: 1.0,
          kind: 'in',
        }
      }

      if (following && shot && anchor) {
        // 取景高度只在"飞过去"的时候由 computeFocusShot 决定；
        // 之后高度归用户：滚轮 / 中键必须在聚焦状态下继续可用（方案书 §5）。
        if (
          !drag.current.active &&
          !touchDrag.current &&
          !touchManualOrbit.current &&
          !manualOrbit.current &&
          flight.current === null &&
          !drag.current.moved
        ) {
          desired.current.yaw = shot.yaw
          desired.current.pitch = shot.pitch
        }
        // 所有聚焦对象都落在画面左侧，target 用世界坐标 + 屏幕空间偏移算出来，
        // 并且始终阻尼跟随——包括人造卫星。之前对航天器"直接钉死 target"
        // 的做法，配合中键缩放会产生一跳一跳的抽搐（v5 §18）。
        focusTarget(
          anchor.position,
          desired.current.height,
          aspect,
          desired.current.yaw,
          desired.current.target,
          desired.current.pitch
        )
        // Target damping is applied below, after the user pan offset.
      } else if (useAtlasStore.getState().viewLayer === 'DEEP') {
        // VIEW / DEEP：镜头退到能装下整个外太阳系与深空探测器的位置
        desired.current.target.copy(home.current.target)
        // v7 §1：用户自己转过视角之后，这里**不再**把朝向拉回 home——
        // "松开右键就弹回原点"就是这么来的。
        if (!drag.current.active && flight.current === null && !manualOrbit.current) {
          desired.current.yaw = home.current.yaw
          desired.current.pitch = home.current.pitch
        }
        if (!manualZoom.current) desired.current.height = home.current.height * 2.4
      } else {
        // 科普排列 ⇄ 真实位置：两套构图，切按钮才换
        const realMode = useAtlasStore.getState().positionMode === 'REAL'
        const sideView = useAtlasStore.getState().view === 'SIDE'
        const base = realMode
          ? realPositionShot(size.width, size.height)
          : atlasBaseShot(size.width, size.height)
        home.current = base
        desired.current.target.copy(base.target)
        // 科普排列（SIDE）把朝向锁在信息图构图上；
        // 一旦进入 3D 或真实位置模式，朝向归用户，只在他没缩放时贴合尺度。
        if (sideView && !manualOrbit.current && !drag.current.active && !touchDrag.current) {
          desired.current.yaw = base.yaw + pointer.current.x * 0.035
          // 俯仰**不再跟着指针动**：侧视图要的是"黄道面合成一条线"，
          // 哪怕 1.6° 的指针俯仰也会让冥王星那条 162 单位的轨道上下张开几个单位。
          desired.current.pitch = base.pitch
          if (!manualZoom.current) desired.current.height = base.height
        } else if (!manualZoom.current) {
          desired.current.height = base.height
        }
        // Side → 3D：相机与轨道解构同步走完 1.85s
        const t = transition.current
        if (t) {
          t.elapsed += step
          const k = THREE.MathUtils.clamp(t.elapsed / t.duration, 0, 1)
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2
          desired.current.yaw = THREE.MathUtils.lerp(t.fromYaw, t.toYaw, e)
          desired.current.pitch = THREE.MathUtils.lerp(t.fromPitch, t.toPitch, e)
          /**
           * 目标点与高度**不在这里插值**（用户 2026-09-25：切三维时中心点会回弹一下）。
           *
           * 旧版在过渡开始时把当时的 target / height 抓成端点，可那之后紧凑尺度还在
           * 连续变化（base 每帧都在动），两边同时写 desired：过渡结束时镜头被拽回
           * 抓取时的旧构图，看起来就是"中心点回弹一下"。
           * 现在只让这段过渡负责朝向，位置与尺度一律交给 base（它本来就是连续变化的）。
           */
          if (k >= 1) transition.current = null
        }
      }
      desired.current.target.add(manualOffset.current)

      const damp = 1 - Math.pow(0.0018, step)
      current.current.target.lerp(desired.current.target, damp)
      current.current.height += (desired.current.height - current.current.height) * damp
      current.current.yaw += (desired.current.yaw - current.current.yaw) * damp
      current.current.pitch += (desired.current.pitch - current.current.pitch) * damp
    }

    const { target, height, yaw, pitch } = current.current
    const halfH = height / 2
    const halfW = halfH * (size.width / Math.max(size.height, 1))
    if (Math.abs(camera.top - halfH) > 1e-4 || Math.abs(camera.right - halfW) > 1e-4) {
      camera.top = halfH
      camera.bottom = -halfH
      camera.right = halfW
      camera.left = -halfW
      camera.updateProjectionMatrix()
    }

    const dir = scratchDir.set(
      Math.cos(pitch) * Math.sin(yaw),
      Math.sin(pitch),
      Math.cos(pitch) * Math.cos(yaw)
    )
    camera.position.copy(target).addScaledVector(dir, 900)
    camera.lookAt(target)
    camera.updateMatrixWorld()
    // 发布系统盘方向：必须早于其它 useFrame（priority -1）。
    //
    // 只在"侧视图总览"里让盘面跟着镜头微调。一旦进入 ORBIT_3D 或聚焦某个天体，
    // 盘面必须冻结在它自己的真实姿态上——否则转视角时轨道会跟着镜头一起转，
    // 永远读不出真实的轨道倾角（方案书 §3 / Rule 03）。
    const atlasState = useAtlasStore.getState()
    if (atlasState.focusKind === 'ATLAS' && atlasState.view === 'SIDE') {
      applyDiskFrame(yaw, pitch)
    }

    // 展开进度写回 store，供 HUD 显示（量化后再写，避免每帧触发订阅者）
    const level = Math.round(orbitPose.value * 50) / 50
    if (level !== useAtlasStore.getState().unfoldLevel) {
      useAtlasStore.getState().setUnfoldLevel(level)
    }

  }, -1)

  return null
}
