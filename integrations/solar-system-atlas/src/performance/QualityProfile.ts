import { deviceClassOf, getLayoutMode, type DeviceClass } from '../responsive/device'
import { maxDprFor } from '../responsive/renderProfile'

/**
 * 质量档位与降级阶梯（V1.1 §11 / §12 / §15 / §16 / §17 / §18）。
 *
 * 关键设计：**阶梯是一串有序的"一步"**，不是几个互不相干的开关。
 * 每次降级只走下去一步，所以性能不够时不会出现"整个画面突然糊掉"。
 *
 * 方案书 §12 的顺序：
 *   1 Shadow map  → 本站渲染器根本没有 shadow map，标 N/A（见 LADDER 注释）
 *   2 Bloom quality
 *   3 Star count
 *   4 Asteroid detail
 *   5 Label count
 *   6 Texture resolution
 *   7 PostFX pass count
 *   8 Sun corona detail
 *   9 DPR
 */

export type QualityLevel = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE'

export const QUALITY_LEVELS: QualityLevel[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'SAFE']

export interface QualitySettings {
  level: QualityLevel
  /** 已经走下的阶梯步数（自检用） */
  steps: number
  /** 星点数量倍率（叠加在设备档位之上） */
  starScale: number
  /** 小行星带粒子密度（draw range 比例） */
  beltDensity: number
  /** 标签密度倍率（Semantic LOD 收紧程度） */
  labelDensity: number
  /** Bloom 强度倍率 */
  bloomStrength: number
  /** Bloom 内部模糊分辨率倍率（§31 的半分辨率基础值上再乘） */
  bloomResolution: number
  /** 是否还跑后处理（false = 直接渲染，跳过 composer） */
  postFx: boolean
  /** 太阳日冕 / 色球层细节 0..1 */
  coronaDetail: number
  /** 贴图各向异性过滤：8 / 4 / 2 / 1 */
  textureAnisotropy: number
  /** 是否生成 mipmap（关掉省显存与带宽，代价是远景闪） */
  textureMipmaps: boolean
  /** 渲染分辨率倍率（叠加在设备 DPR 上限之上） */
  dprScale: number
}

interface LadderStep {
  name: string
  apply: (settings: QualitySettings) => void
}

/**
 * 降级阶梯：从"满配"开始，每走一步牺牲**一项**。
 * 顺序严格按 §12，跳过本站不存在的效果（shadow map / SSAO / DOF / god rays）。
 */
export const LADDER: LadderStep[] = [
  {
    name: 'bloom-quality',
    apply: (s) => {
      s.bloomResolution = 0.35
    },
  },
  {
    name: 'star-count',
    apply: (s) => {
      s.starScale *= 0.72
    },
  },
  {
    name: 'asteroid-detail',
    apply: (s) => {
      s.beltDensity *= 0.7
    },
  },
  {
    name: 'bloom-strength',
    apply: (s) => {
      s.bloomStrength *= 0.85
    },
  },
  {
    name: 'label-count',
    apply: (s) => {
      s.labelDensity *= 0.75
    },
  },
  {
    name: 'texture-quality',
    apply: (s) => {
      s.textureAnisotropy = 4
    },
  },
  {
    name: 'star-count-2',
    apply: (s) => {
      s.starScale *= 0.7
    },
  },
  {
    name: 'corona-detail',
    apply: (s) => {
      s.coronaDetail *= 0.7
    },
  },
  {
    name: 'postfx-off',
    apply: (s) => {
      s.postFx = false
    },
  },
  {
    name: 'dpr-1',
    apply: (s) => {
      s.dprScale *= 0.88
    },
  },
  {
    name: 'belt-density-2',
    apply: (s) => {
      s.beltDensity *= 0.6
    },
  },
  {
    name: 'dpr-2',
    apply: (s) => {
      s.dprScale *= 0.8
    },
  },
  {
    name: 'label-count-2',
    apply: (s) => {
      s.labelDensity *= 0.6
    },
  },
  {
    name: 'texture-low',
    apply: (s) => {
      s.textureAnisotropy = 1
      s.textureMipmaps = false
    },
  },
  {
    name: 'star-safe',
    apply: (s) => {
      s.starScale *= 0.6
      s.coronaDetail *= 0.6
      s.bloomStrength *= 0.5
    },
  },
]

/** 每个档位对应的阶梯步数（ULTRA = 一步都不走） */
const STEPS_FOR_LEVEL: Record<QualityLevel, number> = {
  ULTRA: 0,
  HIGH: 1,
  MEDIUM: 4,
  LOW: 8,
  SAFE: LADDER.length,
}

export function stepsForLevel(level: QualityLevel): number {
  return STEPS_FOR_LEVEL[level]
}

function baseSettings(level: QualityLevel): QualitySettings {
  return {
    level,
    steps: STEPS_FOR_LEVEL[level],
    starScale: 1,
    beltDensity: 1,
    labelDensity: 1,
    bloomStrength: 1,
    bloomResolution: 0.5,
    postFx: true,
    coronaDetail: 1,
    textureAnisotropy: 8,
    textureMipmaps: true,
    dprScale: 1,
  }
}

const cache = new Map<QualityLevel, QualitySettings>()

const freeze = (settings: QualitySettings): QualitySettings => Object.freeze(settings)

/** 某个档位的完整参数（按阶梯前缀计算，带缓存） */
export function settingsForLevel(level: QualityLevel): QualitySettings {
  const cached = cache.get(level)
  if (cached) return cached
  const settings = baseSettings(level)
  for (let i = 0; i < STEPS_FOR_LEVEL[level]; i++) {
    LADDER[i]?.apply(settings)
  }
  const result = freeze(settings)
  cache.set(level, result)
  return result
}

/**
 * 每个设备的**起始档位**（§15）。
 *
 * 设备档位（renderProfile）负责"手机本来就不该跟桌面一样满血"，
 * 质量档位负责"同一台设备在掉帧时怎么一步步退"。
 * 两者相乘，互不覆盖。
 */
export function defaultLevelFor(device: DeviceClass): QualityLevel {
  if (device === 'desktop') return 'ULTRA'
  if (device === 'tablet') return 'HIGH'
  return 'HIGH'
}

/** 当前设备能用的最大 DPR（设备上限 × 质量倍率） */
export function qualityDpr(level: QualityLevel): number {
  const layoutCap = maxDprFor(getLayoutMode())
  const device = deviceClassOf(getLayoutMode())
  const settings = settingsForLevel(level)
  const raw = (window.devicePixelRatio || 1) * settings.dprScale
  /**
   * 真机反馈"贴图很糊"：阶梯最后两步会把渲染分辨率压到 1.0 以下
   * （手机上限 1.35 × 0.7 = 0.95），也就是"一个 CSS 像素还分不到一个真实像素"，
   * 整幅画面都会发虚。所以移动端给一个 **1.0 的地板**：
   * 降级优先动其他杠杆，DPR 只在上限与地板之间调。
   * 桌面不参与自适应，这一路不会执行。
   */
  const floor = device === 'desktop' ? 0 : 1
  return Math.min(layoutCap, Math.max(floor, raw))
}
