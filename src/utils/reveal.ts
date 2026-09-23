import { deviceClassOf, getLayoutMode } from '../responsive/device'

/**
 * LOD 增益（V1.1 真机修复）。
 *
 * satelliteVisibility / minorSatelliteVisibility 的门限（24~96px）是**桌面
 * 1600×900 上调出来的**：那里可见高度约 114 单位、画布高 760px，
 * 于是"木星系统盘 ≈ 41px"刚好落在门限内，卫星同心圆会淡淡地浮出来。
 *
 * 换成竖屏手机 / iPad，同一张图谱的可见高度变成 178~393 单位
 * （因为侧视图按宽度装下同一段横向跨度），而画布反而更矮——
 * 木星系统盘只剩 13~21px，全部掉到门限以下。
 * 结果就是真机反馈的"轨道 UI 完全看不见"：轨道线、卫星点、标签一起消失。
 *
 * 这里把 LOD 输入乘一个设备增益，把它**归一到桌面的观感**：
 * 同一个取景下，手机 / iPad 该看到的轨道环，和桌面看到的一样多。
 * 桌面增益恒为 1（数值与 V1 逐位相同），所以桌面零变化。
 */
const LOD_GAIN: Record<string, number> = {
  desktop: 1,
  tablet: 2,
  mobile: 3.2,
}

export function lodGain(): number {
  return LOD_GAIN[deviceClassOf(getLayoutMode())] ?? 1
}

/**
 * 场景揭示度（v7.2）。
 *
 * 0 = 开场：只看得见太阳与行星轨道骨架（主页的背景就是**真的那个宇宙**，
 *     不是另画一套装饰，所以进入时不需要"切换"，只有一次连续的镜头拉远）。
 * 1 = 完整图谱。
 *
 * 和 `timeControl` / `yearControl` 一样是模块级对象：CameraRig 每帧写，
 * 各图层的 useFrame 每帧读，完全不经过 React，因此不会触发重渲染。
 */
export const sceneReveal = {
  /** 当前揭示度 0…1 */
  value: 0,
}

/** 一条平滑的揭示曲线：smoothstep，用来给各图层分段淡入 */
export function revealRamp(from: number, to: number, value = sceneReveal.value): number {
  const t = Math.min(1, Math.max(0, (value - from) / Math.max(to - from, 1e-4)))
  return t * t * (3 - 2 * t)
}

/**
 * 开场时轨道线的亮度系数。
 *
 * 不是 0：主页上"一圈一圈的轨道"正是图谱的骨架，它必须在场，
 * 只是比图谱状态弱一档——进入的时候站在原地变亮，而不是从无到有地闪出来。
 */
export function orbitRevealFactor(): number {
  return 0.42 + 0.58 * revealRamp(0.05, 0.85)
}

/**
 * 帧率无关的阻尼（v8 §20 / §51）。
 * 用指数衰减而不是 lerp(t)——后者在不同帧率下速度完全不同。
 */
export function damp(current: number, target: number, lambda: number, delta: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * Math.max(delta, 0)))
}

/**
 * 行星系统（同心圆 + 卫星 + 标签）的统一可见度（v8 §20）。
 *
 * 旧版是三套阈值：轨道线 diskScreen > 70、卫星点 > 26、标签又是另一个公式——
 * 于是"轨道出来了、点还没出来"，而且都是硬阈值，到点就跳。
 * 现在只留这一个连续函数：轨道线、卫星点、标签全部乘它，再各自做阻尼，
 * 推近的过程因此是一次连续浮现。
 */
export function satelliteVisibility(diskScreen: number): number {
  const value = diskScreen * lodGain()
  const t = Math.min(1, Math.max(0, (value - 24) / 72))
  return t * t * (3 - 2 * t)
}

/** 更晚才出现的"小卫星 / 人造卫星密集层"：比整体可见度再晚一档 */
export function minorSatelliteVisibility(diskScreen: number): number {
  const value = diskScreen * lodGain()
  const t = Math.min(1, Math.max(0, (value - 58) / 60))
  return t * t * (3 - 2 * t)
}

/**
 * 聚焦时的背景压暗系数（v8 §26）。
 *
 * 规则：焦点对象保持 1.0，其余一切按层级退到背景——
 *   其他行星 0.20 / 其他轨道 0.08 / 其他航天器 0.06 / 星空 0.18
 * 不做成"全屏变暗"：那样焦点对象一起被压掉，画面就只剩一块黑。
 */
export interface BackgroundDim {
  planets: number
  orbits: number
  objects: number
  stars: number
}

const DIM_NONE: BackgroundDim = { planets: 1, orbits: 1, objects: 1, stars: 1 }
const DIM_BODY: BackgroundDim = { planets: 0.14, orbits: 0.08, objects: 0.06, stars: 0.18 }
const DIM_REGION: BackgroundDim = { planets: 0.45, orbits: 0.2, objects: 0.2, stars: 0.4 }
const DIM_OBJECT: BackgroundDim = { planets: 0.5, orbits: 0.25, objects: 0.6, stars: 0.4 }

export function focusBackgroundDim(focusKind: string): BackgroundDim {
  if (focusKind === 'PLANET' || focusKind === 'MOON') return DIM_BODY
  if (focusKind === 'REGION' || focusKind === 'COMET') return DIM_REGION
  if (focusKind === 'OBJECT') return DIM_OBJECT
  return DIM_NONE
}
