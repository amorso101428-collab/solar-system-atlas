/**
 * DOM 标签层：由 JS 直接创建并更新节点。
 * 不用 React 渲染每帧投影结果，避免 60fps 触发 React re-render。
 */

export type LabelKind = 'planet' | 'moon' | 'object' | 'region'

interface LabelEntry {
  root: HTMLDivElement
  leader: HTMLDivElement
  inner: HTMLDivElement
  text: HTMLSpanElement
  sub: HTMLSpanElement
  visible: boolean
}

interface CometMarkerEntry {
  root: HTMLDivElement
  ring: HTMLElement
  visible: boolean
}

export class LabelLayer {
  private entries = new Map<string, LabelEntry>()
  private markers = new Map<string, CometMarkerEntry>()
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
  }

  ensure(id: string, kind: LabelKind, text: string, sub = ''): void {
    if (this.entries.has(id)) return
    const root = document.createElement('div')
    root.className = `label label--${kind}`
    const leader = document.createElement('div')
    leader.className = 'leader'
    const inner = document.createElement('div')
    inner.className = 'label__inner'
    const textEl = document.createElement('span')
    textEl.className = 'label__text'
    textEl.textContent = text
    const subEl = document.createElement('span')
    subEl.className = 'label__sub'
    subEl.textContent = sub
    inner.append(textEl, subEl)
    root.append(leader, inner)
    root.style.opacity = '0'
    root.style.display = 'none'
    this.container.appendChild(root)
    this.entries.set(id, { root, leader, inner, text: textEl, sub: subEl, visible: false })
  }

  update(
    id: string,
    x: number,
    y: number,
    offsetX: number,
    offsetY: number,
    opacity: number,
    state: { hovered?: boolean; selected?: boolean; dimmed?: boolean; flip?: boolean } = {}
  ): void {
    const entry = this.entries.get(id)
    if (!entry) return
    const show = opacity > 0.02
    if (!show) {
      if (entry.visible) {
        entry.root.style.display = 'none'
        entry.visible = false
      }
      return
    }
    if (!entry.visible) {
      entry.root.style.display = 'block'
      entry.visible = true
    }
    entry.root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    entry.root.style.opacity = opacity.toFixed(3)
    // 靠近右边缘时标签向左展开，避免被档案面板压住
    if (state.flip) {
      entry.inner.style.transform = `translate3d(calc(-100% + ${offsetX}px), ${offsetY}px, 0)`
      entry.inner.style.textAlign = 'right'
    } else {
      entry.inner.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`
      entry.inner.style.textAlign = 'left'
    }

    const length = Math.hypot(offsetX, offsetY)
    entry.leader.style.width = `${length.toFixed(1)}px`
    entry.leader.style.transform = `rotate(${Math.atan2(offsetY, offsetX).toFixed(4)}rad)`
    entry.leader.style.opacity = opacity.toFixed(3)

    entry.root.classList.toggle('is-hovered', !!state.hovered)
    entry.root.classList.toggle('is-selected', !!state.selected)
    entry.root.classList.toggle('is-dimmed', !!state.dimmed)
  }

  /**
   * 彗星的平面标记（v7 §12）：
   * **只保留核**——一个点 + 一圈细环。
   * 旧版那条"背离太阳方向的尾迹线 + 箭头"被删掉了：真实彗尾是弥散的，
   * 用一根带箭头的线表示既不准也不好看；彗尾的方向信息由太阳方向本身提供。
   */
  ensureCometMarker(id: string): void {
    if (this.markers.has(id)) return
    const root = document.createElement('div')
    root.className = 'comet-marker'
    const ring = document.createElement('i')
    ring.className = 'comet-marker__ring'
    const head = document.createElement('i')
    head.className = 'comet-marker__head'
    root.append(ring, head)
    root.style.opacity = '0'
    root.style.display = 'none'
    this.container.appendChild(root)
    this.markers.set(id, { root, ring, visible: false })
  }

  updateCometMarker(
    id: string,
    x: number,
    y: number,
    scale: number,
    opacity: number,
    state: { hovered?: boolean; selected?: boolean } = {}
  ): void {
    const entry = this.markers.get(id)
    if (!entry) return
    const show = opacity > 0.02
    if (!show) {
      if (entry.visible) {
        entry.root.style.display = 'none'
        entry.visible = false
      }
      return
    }
    if (!entry.visible) {
      entry.root.style.display = 'block'
      entry.visible = true
    }
    entry.root.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`
    entry.root.style.opacity = opacity.toFixed(3)
    entry.root.classList.toggle('is-hovered', !!state.hovered)
    entry.root.classList.toggle('is-selected', !!state.selected)
  }

  dispose(): void {
    this.entries.forEach((entry) => entry.root.remove())
    this.entries.clear()
    this.markers.forEach((marker) => marker.root.remove())
    this.markers.clear()
  }
}
