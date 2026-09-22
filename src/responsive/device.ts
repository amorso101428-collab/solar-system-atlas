/**
 * 设备与布局模式（iPad / Mobile 方案书 §02）。
 *
 * 不只用 `@media (max-width: 768px)`：这里按"视口短边 + 主指针类型"综合判定，
 * 得到一个**单一的布局模式**，CSS、Camera、手势、渲染档位全部读同一个值，
 * 避免"CSS 认为是手机、相机还按桌面取景"这种各说各话的情况。
 *
 * 桌面端（鼠标 / 触控板，hover: hover）**永远**落在 desktop，
 * 窄窗口也一样——V1 的硬性要求是桌面端零变化，不允许因为窗口拉窄
 * 就悄悄换一套布局。移动端布局只在真机（触屏主指针）或显式
 * `?device=phone|tablet|desktop` 自检开关下启用。
 */

export type LayoutMode =
  | 'desktop'
  | 'tablet-landscape'
  | 'tablet-portrait'
  | 'mobile-landscape'
  | 'mobile-portrait'

export type DeviceClass = 'desktop' | 'tablet' | 'mobile'

/** 短边小于这个值按手机处理（实测机型最长短边 430） */
const PHONE_MAX_SHORT_SIDE = 600
/** 触屏设备短边小于这个值按平板处理（12.9" iPad 竖屏短边 1024） */
const TABLET_MAX_SHORT_SIDE = 1100

/**
 * 主指针是不是"手指"。
 *
 * 只看 `(pointer: coarse)` 不够：Windows 触屏本在没有鼠标时会报 coarse，
 * 但它是横屏大窗口、而且用户随时会接回鼠标，那台机器应该留在 desktop。
 * 手上真正只有手指的设备同时满足 `hover: none`。
 */
function hasTouchPointer(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  if (
    window.matchMedia('(pointer: coarse)').matches &&
    window.matchMedia('(hover: none)').matches
  ) {
    return true
  }
  /*
   * iPad 接上妙控键盘 / 触控板后，Safari 有可能报 (hover: hover) + (pointer: fine)，
   * 于是上面那组判断会把这台 iPad 判成桌面。iPadOS 13 以后的 UA 是
   * "Macintosh"，只有靠 maxTouchPoints 才能认出它来（真 Mac 这里是 0）。
   */
  const ua = navigator.userAgent ?? ''
  if (/iPad/.test(ua)) return true
  if (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1) return true
  return false
}

function readOverride(): DeviceClass | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('device')
  if (value === 'phone' || value === 'mobile') return 'mobile'
  if (value === 'tablet' || value === 'ipad') return 'tablet'
  if (value === 'desktop' || value === 'pc') return 'desktop'
  return null
}

function orientationOf(width: number, height: number): 'portrait' | 'landscape' {
  return width >= height ? 'landscape' : 'portrait'
}

export function resolveLayoutMode(
  width: number,
  height: number,
  touch: boolean,
  override: DeviceClass | null = null
): LayoutMode {
  const shortSide = Math.min(width, height)
  const orientation = orientationOf(width, height)

  if (override === 'desktop') return 'desktop'
  if (override === 'mobile') return orientation === 'portrait' ? 'mobile-portrait' : 'mobile-landscape'
  if (override === 'tablet') return orientation === 'portrait' ? 'tablet-portrait' : 'tablet-landscape'

  // 非触屏 = 桌面端（含鼠标 / 触控板 / 触屏笔记本接鼠标的情况）
  if (!touch) return 'desktop'

  if (shortSide < PHONE_MAX_SHORT_SIDE) {
    return orientation === 'portrait' ? 'mobile-portrait' : 'mobile-landscape'
  }
  if (shortSide < TABLET_MAX_SHORT_SIDE) {
    return orientation === 'portrait' ? 'tablet-portrait' : 'tablet-landscape'
  }
  return 'desktop'
}

export function deviceClassOf(mode: LayoutMode): DeviceClass {
  if (mode === 'desktop') return 'desktop'
  return mode.startsWith('tablet') ? 'tablet' : 'mobile'
}

/** 这套布局下用户是"用手指操作"的吗（决定要不要接管触摸手势） */
export function isTouchLayout(mode: LayoutMode): boolean {
  return mode !== 'desktop'
}

/** 竖屏 / 手机：详情不再占右侧，而是压在下半屏或底部抽屉里 */
export function usesVerticalDetail(mode: LayoutMode): boolean {
  return mode === 'tablet-portrait' || deviceClassOf(mode) === 'mobile'
}

// ------------------------------------------------------------------ 运行时

let currentMode: LayoutMode = 'desktop'
let currentTouch = false
const listeners = new Set<() => void>()

export function getLayoutMode(): LayoutMode {
  return currentMode
}

export function getTouchInput(): boolean {
  return currentTouch
}

export function subscribeLayoutMode(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function measure(): { mode: LayoutMode; touch: boolean } {
  const width = window.innerWidth || document.documentElement.clientWidth || 1024
  // 用 visualViewport 更接近真机（Safari 的地址栏收起时 innerHeight 会变）
  const height = window.visualViewport?.height ?? window.innerHeight ?? 768
  const touch = hasTouchPointer() || readOverride() !== null
  return { mode: resolveLayoutMode(width, height, touch, readOverride()), touch }
}

/**
 * 写 DOM 属性。CSS 全部挂在 `.atlas[data-device=...]` 上，
 * 于是"桌面端零变化"只取决于这一个属性——桌面下这些选择器根本不匹配。
 */
function publish(): void {
  const root = document.documentElement
  root.dataset.device = deviceClassOf(currentMode)
  root.dataset.layout = currentMode
  /**
   * V1.1 §25 / §27：iOS Safari 地址栏收起、软键盘弹出，改变的都是
   * **visualViewport**，而不是布局视口。这里把三个量都同步给 CSS：
   *
   *   --app-height       可视高度（地址栏变化时跟着变）
   *   --vv-height        同上，用于全屏浮层（搜索 / 菜单）
   *   --vv-offset-top    可视区相对布局视口的偏移（键盘把内容顶上去时非 0）
   *
   * 注意：这里**只更新布局指标**，绝不触碰 Camera / Scene（§24）。
   */
  const visualHeight = window.visualViewport?.height ?? window.innerHeight
  const visualOffset = window.visualViewport?.offsetTop ?? 0
  root.style.setProperty('--app-height', `${Math.round(visualHeight)}px`)
  root.style.setProperty('--vv-height', `${Math.round(visualHeight)}px`)
  root.style.setProperty('--vv-offset-top', `${Math.round(visualOffset)}px`)
  /** 键盘判据：可视高度比布局高度少了一大截（§27） */
  const keyboardOpen = Boolean(window.visualViewport) && window.innerHeight - visualHeight > 120
  root.dataset.keyboard = keyboardOpen ? 'open' : 'closed'
}

let started = false

/** 在 React 挂载之前调用：先落一次属性，避免首帧闪一下桌面布局 */
export function startResponsiveRuntime(): void {
  if (started || typeof window === 'undefined') return
  started = true

  const sync = () => {
    const next = measure()
    const changed = next.mode !== currentMode
    currentMode = next.mode
    currentTouch = next.touch
    publish()
    if (changed) listeners.forEach((listener) => listener())
  }

  sync()
  window.addEventListener('resize', sync, { passive: true })
  window.addEventListener('orientationchange', sync, { passive: true })
  window.visualViewport?.addEventListener('resize', sync, { passive: true })
  window.matchMedia?.('(pointer: coarse)')?.addEventListener?.('change', sync)
  window.matchMedia?.('(hover: none)')?.addEventListener?.('change', sync)
}

/** 供自检脚本读取（tools/ui-probe.ps1 那套写法） */
export function layoutDebugInfo(): Record<string, unknown> {
  return {
    mode: currentMode,
    device: deviceClassOf(currentMode),
    touch: currentTouch,
    width: window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  }
}
