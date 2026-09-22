/** 统一数据模型：既有地球卫星，也有望远镜、行星轨道器、深空探测器、着陆器。 */

/** 标记形状：不同种类的造物用不同的极简剪影，而不是统一的圆点 */
export type GlyphKind =
  | 'dot'
  | 'station'
  | 'telescope'
  | 'probe'
  | 'mirror'
  | 'solar'
  | 'rover'
  | 'capsule'

export type ObjectCategory =
  | 'EARTH'
  | 'MOON'
  | 'MARS'
  | 'OUTER'
  | 'SMALL_BODY'
  | 'SOLAR'
  | 'DEEP_SPACE'

export type ObjectKind =
  | 'satellite'
  | 'station'
  | 'telescope'
  | 'orbiter'
  | 'lander'
  | 'rover'
  | 'probe'
  | 'capsule'
  | 'constellation'

export type ObjectStatus =
  | 'ACTIVE'
  | 'EXTENDED'
  | 'COMPLETED'
  | 'DECAYED'
  | 'IMPACTED'
  | 'LANDED'
  | 'IN TRANSIT'
  | 'LOST'

export interface SourceRef {
  title: string
  url: string
}

export interface LocalizedText {
  zh: string
  en: string
}

export interface TimelineEvent {
  date: string
  text: LocalizedText
}

export interface Specs {
  mass?: string
  power?: string
  velocity?: string
  dimensions?: string
  launchVehicle?: string
  orbitPeriod?: string
  instruments?: string[]
}

export interface SpaceObject {
  id: string
  name: string
  nameCn: string
  kind: ObjectKind
  category: ObjectCategory
  system: SystemId
  /** 1 = 主视觉对象（完整档案）；2 = 可点可搜（简版）；3 = 空间密度（默认极简） */
  importance?: 1 | 2 | 3
  /** 是否在首屏就给出标签 */
  featured?: boolean
  /** 轨道要素是按类型推断的，不是逐条测量 */
  syntheticOrbit?: boolean
  /** 标记剪影 */
  glyph?: GlyphKind
  orbitClass: LocalizedText
  launched: string
  operator: LocalizedText
  status: ObjectStatus
  /** 一句话定位 */
  mission: LocalizedText
  /** 它是什么 */
  summary: LocalizedText
  /** 它为什么重要 */
  why: LocalizedText
  distanceAu: number
  distanceLabel: LocalizedText
  specs: Specs
  timeline: TimelineEvent[]
  tags: FilterTag[]
  imageQuery: string
  sources: SourceRef[]
}

export type SystemId =
  | 'sun'
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'moon'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'pluto'
  | 'belt'
  | 'deep'

export type FilterTag =
  | 'science'
  | 'crewed'
  | 'comms'
  | 'navigation'
  | 'earth-observation'
  | 'historical'
  | 'planetary'
  | 'astronomy'

export type SurfaceMode = 'star' | 'rocky' | 'cratered' | 'cloudy' | 'gas' | 'ice' | 'earth' | 'mars'

export interface MoonDef {
  id: string
  name: string
  nameCn: string
  orbitRadius: number
  /** 视觉半径（由真实半径经 visualScale 压缩得到） */
  radius: number
  /** 真实平均半径 km（没有可靠数据时为 undefined） */
  radiusKm?: number
  surface: SurfaceMode
  color: string
  /** public/planets 下的贴图文件名（不含扩展名）；没有就走程序化表面 */
  texture?: string
  periodDays: number
  note?: string
  /** 真实自转要素（IAU）：月球是潮汐锁定，姿态由母体方向决定 */
  orientation?: import('../astronomy/orientation').BodyOrientation
  /** 是否潮汐锁定（永远同一面朝着母体） */
  tidalLocked?: boolean
}

export interface RingDef {
  inner: number
  outer: number
  tilt: number
  color: string
  opacity: number
  bands: number
}

/**
 * 历元 J2000 的轨道根数（真实位置模式用）。
 * 只用于把行星摆到"这个时间点上它真正在的黄经"，不做高精度星历。
 */
export interface PlanetElements {
  /** 半长轴，AU */
  a: number
  /** 偏心率 */
  e: number
  /** 轨道倾角，deg */
  i: number
  /** 升交点黄经 Ω，deg */
  node: number
  /** 近日点黄经 ϖ，deg */
  peri: number
  /** J2000 平黄经 L，deg */
  l0: number
  /** 公转周期，天 */
  period: number
}

export interface PlanetDef {
  id: SystemId
  name: string
  nameCn: string
  surface: SurfaceMode
  /** 艺术化轨道半径：与真实天文距离解耦（方案书 §4） */
  displayDistance: number
  orbitEcc: number
  orbitIncl: number
  phase: number
  radius: number
  color: string
  /** public/planets 下的贴图文件名（不含扩展名） */
  texture: string
  ringTexture?: string
  axialTilt: number
  /** 真实自转要素（IAU 极轴 / 本初子午线 / 自转速率），姿态由它推导（v5 §15） */
  orientation: import('../astronomy/orientation').BodyOrientation
  rotationHours: number
  atmosphere?: { color: string; strength: number }
  rings?: RingDef
  moons: MoonDef[]
  /** 真实位置模式用：J2000 轨道根数 */
  elements: PlanetElements
  realAu: number
  realRadiusKm: number
  moonCount: number
  note: string
}

export interface FilterDef {
  id: string
  label: string
  match: (object: SpaceObject) => boolean
}
