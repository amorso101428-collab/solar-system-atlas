import { glStats } from '../utils/glStats'
import { gpuStats } from '../utils/perfSampler'
import { deviceClassOf, getLayoutMode } from '../responsive/device'
import {
  QUALITY_LEVELS,
  defaultLevelFor,
  settingsForLevel,
  stepsForLevel,
  type QualityLevel,
  type QualitySettings,
} from './QualityProfile'

/**
 * 自适应画质管理（V1.1 §11 – §14 / §29 / §30）。
 *
 * 与 V1 的 PerfGovernor 的关系：
 *   · **桌面**：PerfGovernor 原样保留（那是被冻结的 V1 行为）；
 *   · **平板 / 手机**：由这里接管——采样 → 判定 → 走一步阶梯 → 应用。
 *
 * 三条防抖纪律（§13 / §14）：
 *   1. 按 ~1s 的采样窗口统计（平均帧时 + P95），不是逐帧改画质
 *   2. 连续 2 个窗口超标才降级；连续 5 个窗口宽裕才升级
 *   3. 每次换档之后 cooldown 1800ms 内不再动
 *
 * §30：拿不到的系统数据（CPU 占用率 / GPU 利用率 / 真实显存）一律 N/A，
 * 绝不把帧时间冒充成 GPU 利用率。
 */

export type QualityMode = 'auto' | 'fixed'

export interface QualityMetrics {
  /** 最近一个窗口的平均帧率 */
  fps: number
  /** 最近一个窗口的平均帧时间（ms） */
  frameTime: number
  /** 最近一个窗口的 P95 帧时间（ms） */
  p95FrameTime: number
  /** 已经统计了多少个窗口 */
  windows: number
  /** 连续多少个窗口超标 */
  badStreak: number
  /** 连续多少个窗口宽裕 */
  goodStreak: number
  /** 距离下一次允许换档还有多少毫秒 */
  cooldownLeft: number
}

/** 目标帧时：60fps */
const BUDGET_MS = 1000 / 60
const WINDOW_MS = 1000
const DEGRADE_RATIO = 1.25
const UPGRADE_RATIO = 0.8
const BAD_WINDOWS_TO_DEGRADE = 2
const GOOD_WINDOWS_TO_UPGRADE = 5
const COOLDOWN_MS = 1800

function parseOverride(): QualityMode | QualityLevel {
  if (typeof window === 'undefined') return 'auto'
  const raw = new URLSearchParams(window.location.search).get('quality')
  if (!raw) return 'auto'
  const value = raw.toLowerCase()
  if (value === 'auto') return 'auto'
  if (value === 'low') return 'LOW'
  if (value === 'medium') return 'MEDIUM'
  if (value === 'high') return 'HIGH'
  if (value === 'ultra') return 'ULTRA'
  if (value === 'safe') return 'SAFE'
  return 'auto'
}

class AdaptiveQualityManagerImpl {
  level: QualityLevel
  mode: QualityMode = 'auto'
  metrics: QualityMetrics = {
    fps: 0,
    frameTime: 0,
    p95FrameTime: 0,
    windows: 0,
    badStreak: 0,
    goodStreak: 0,
    cooldownLeft: 0,
  }

  private listeners = new Set<() => void>()
  private samples: number[] = []
  private windowStart = 0
  private lastChange = 0
  private started = false

  constructor() {
    this.level = defaultLevelFor(deviceClassOf(getLayoutMode()))
  }

  /** 桌面不参与自适应（V1 的 PerfGovernor 继续管 DPR） */
  get active(): boolean {
    return deviceClassOf(getLayoutMode()) !== 'desktop'
  }

  get settings(): QualitySettings {
    return settingsForLevel(this.level)
  }

  get steps(): number {
    return stepsForLevel(this.level)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 自检入口：?quality=low|medium|high|ultra|safe|auto */
  start(): void {
    if (this.started) return
    this.started = true
    const override = parseOverride()
    if (override !== 'auto') {
      this.mode = 'fixed'
      this.level = override as QualityLevel
      this.emit()
    } else {
      this.mode = 'auto'
    }
  }

  /** 每帧上报（由 QualityController 在 Canvas 内调用） */
  reportFrame(frameTimeMs: number): void {
    const now = performance.now()
    if (document.hidden) {
      // §32：切后台不采样，避免把"暂停"读成"卡顿"
      this.samples = []
      this.windowStart = now
      return
    }
    if (this.windowStart === 0) this.windowStart = now
    this.samples.push(frameTimeMs)
    if (now - this.windowStart < WINDOW_MS) return
    this.closeWindow(now)
  }

  /** 外部强制档位（自检 / 调试） */
  setLevel(level: QualityLevel, mode: QualityMode = 'fixed'): void {
    if (level === this.level && mode === this.mode) return
    this.level = level
    this.mode = mode
    this.lastChange = performance.now()
    this.metrics.badStreak = 0
    this.metrics.goodStreak = 0
    this.emit()
  }

  debugInfo(): Record<string, unknown> {
    const renderer = glStats.renderer
    const info = renderer?.info
    return {
      level: this.level,
      steps: this.steps,
      mode: this.mode,
      active: this.active,
      metrics: { ...this.metrics, cooldownLeft: this.cooldownLeft() },
      settings: this.settings,
      render: info
        ? {
            calls: info.render.calls,
            triangles: info.render.triangles,
            points: info.render.points,
            lines: info.render.lines,
            geometries: info.memory.geometries,
            textures: info.memory.textures,
            programs: info.programs?.length ?? null,
          }
        : null,
      gpu: {
        timerSupported: gpuStats.supported,
        gpuMs: gpuStats.ms,
        // §30：这三项浏览器不提供，写 N/A，不猜
        cpuUtilization: 'N/A',
        gpuUtilization: 'N/A',
        vramActual: 'N/A',
      },
    }
  }

  private cooldownLeft(): number {
    if (!this.lastChange) return 0
    return Math.max(0, Math.round(COOLDOWN_MS - (performance.now() - this.lastChange)))
  }

  private closeWindow(now: number): void {
    const samples = this.samples
    this.samples = []
    this.windowStart = now
    if (samples.length < 10) return
    const total = samples.reduce((sum, value) => sum + value, 0)
    const average = total / samples.length
    const sorted = [...samples].sort((a, b) => a - b)
    const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? average
    this.metrics = {
      ...this.metrics,
      fps: Math.round(1000 / Math.max(average, 0.001)),
      frameTime: Math.round(average * 100) / 100,
      p95FrameTime: Math.round(p95 * 100) / 100,
      windows: this.metrics.windows + 1,
    }

    if (!this.active || this.mode !== 'auto') return
    if (this.cooldownLeft() > 0) return

    const tooSlow = average > BUDGET_MS * DEGRADE_RATIO
    const plenty = average < BUDGET_MS * UPGRADE_RATIO
    this.metrics.badStreak = tooSlow ? this.metrics.badStreak + 1 : 0
    this.metrics.goodStreak = plenty ? this.metrics.goodStreak + 1 : 0

    if (this.metrics.badStreak >= BAD_WINDOWS_TO_DEGRADE) {
      const index = QUALITY_LEVELS.indexOf(this.level)
      const next = QUALITY_LEVELS[Math.min(QUALITY_LEVELS.length - 1, index + 1)]
      if (next && next !== this.level) this.setLevel(next, 'auto')
      return
    }
    if (this.metrics.goodStreak >= GOOD_WINDOWS_TO_UPGRADE) {
      const index = QUALITY_LEVELS.indexOf(this.level)
      const next = QUALITY_LEVELS[Math.max(0, index - 1)]
      if (next && next !== this.level) this.setLevel(next, 'auto')
    }
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }
}

export const adaptiveQuality = new AdaptiveQualityManagerImpl()
