import {
  loadAlbum,
  loadCustomUrls,
  resolveTrackUrl,
  saveCustomUrl,
  type AlbumTrack,
  type MusicSourceMode,
} from './musicTracks'

/**
 * 声音层（v9 §1–§4）：**只剩背景音乐**。
 *
 * v9 删掉了全部交互音效（hover / click / open / close / focus / back /
 * timeline tick / search / menu / 右键 …），也删掉了整套 SFX 引擎
 * —— 没有 cue 表、没有音频缓冲、没有 AudioContext。
 *
 * 音乐用两个 HTMLAudioElement 轮换播放：
 *   · 浏览器按需流式读取，不把整首歌解进内存；
 *   · 淡入淡出直接渐变 el.volume（跨域直链也能淡，因为不读取采样）；
 *   · 默认从第 1 首开始**顺序播放**，不记忆上次进度、默认不随机。
 *
 * 自动播放：进站立刻尝试；被浏览器策略拦下时，在第一次 pointerdown / keydown
 * 无缝恢复（不会出现挡住主页的"请点击播放"）。
 */
const MUSIC_FADE = 0.9
/** 换曲的交叉淡入淡出时长（秒） */
const MUSIC_CROSSFADE = 2.4

interface MusicSlot {
  el: HTMLAudioElement
  fadeTimer: number | null
  track: AlbumTrack | null
  armed: boolean
}

class AudioManager {
  private slots: MusicSlot[] = []
  private activeSlot = 0
  private volume = 0.32
  private playing = false
  private shuffle = false
  private album: AlbumTrack[] = []
  private track: AlbumTrack | null = null
  private failed = new Set<string>()
  private customUrls = loadCustomUrls()
  /** 默认播放源：网易云官方外链（站内不打包音频，直连唱片公司 CDN） */
  private sourceMode: MusicSourceMode = 'netease'

  /* ------------------------------------------------------------------ 兼容层
   * v9 之前全站用 `audio.emit('button.click')` 这类语义事件触发音效。
   * 音效已经全部删除，这里保留一个明确的空实现，让调用点不必逐个改写，
   * 同时保证**没有任何 SFX 初始化、加载或播放**。
   */
  emit(_event: string): void {
    void _event
  }

  /** 兼容旧调用：v9 不再有 AudioContext 需要解锁 */
  unlock(): void {}

  setEnabled(_value: boolean): void {
    void _value
  }

  /** 兼容旧调用：v9 没有 hover 音，自然也不需要"拖动期间静音" */
  muteHover(_value: boolean): void {
    void _value
  }

  /** 兼容旧的加载页清单：v9 没有 UI 音效素材需要预加载 */
  cueSources(): string[] {
    return []
  }

  /* ---------------------------------------------------------------- 播放列表 */

  setAlbum(tracks: AlbumTrack[]): void {
    this.album = tracks
    if (!this.track || !tracks.some((entry) => entry.id === this.track?.id)) {
      this.track = tracks[0] ?? null
    }
  }

  albumTracks(): AlbumTrack[] {
    return this.album
  }

  async ensureAlbum(): Promise<void> {
    if (this.album.length > 0) return
    this.setAlbum(await loadAlbum())
  }

  setMusicTrack(track: AlbumTrack | null): void {
    this.track = track
  }

  getMusicTrack(): AlbumTrack | null {
    return this.track
  }

  setShuffle(value: boolean): void {
    this.shuffle = value
  }

  isShuffle(): boolean {
    return this.shuffle
  }

  setMusicSourceMode(mode: MusicSourceMode): void {
    this.sourceMode = mode
  }

  getMusicSourceMode(): MusicSourceMode {
    return this.sourceMode
  }

  setCustomFile(trackId: string, file: File): void {
    const previous = this.customUrls.get(trackId)
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous)
    this.customUrls.set(trackId, URL.createObjectURL(file))
  }

  setCustomUrl(trackId: string, url: string): void {
    if (url.trim()) {
      this.customUrls.set(trackId, url.trim())
      saveCustomUrl(trackId, url.trim())
    } else {
      this.customUrls.delete(trackId)
      saveCustomUrl(trackId, '')
    }
  }

  customFiles(): Map<string, string> {
    return this.customUrls
  }

  /**
   * 进站即播：先立刻尝试，被拦下就在第一次用户手势里恢复。
   * 不记忆上次播放位置，刷新后总是从列表第一首开始。
   */
  autoStart(): void {
    let armed = true
    const attempt = () => {
      if (!armed) return
      void this.ensureAlbum()
        .then(() => this.startPlaylist())
        .then(() => {
          if (!this.playing) return
          armed = false
          window.removeEventListener('pointerdown', attempt)
          window.removeEventListener('keydown', attempt)
        })
    }
    void attempt()
    window.addEventListener('pointerdown', attempt)
    window.addEventListener('keydown', attempt)
  }

  /** 从头开始顺序播放 */
  async startPlaylist(): Promise<void> {
    await this.ensureAlbum()
    const track = this.album[0]
    if (!track) return
    this.track = track
    await this.playMusic()
  }

  async playMusic(): Promise<void> {
    if (!this.track) await this.ensureAlbum()
    if (!this.track) return
    if (this.playing) return
    this.ensureSlots()
    this.activeSlot = 0
    const slot = this.slots[0]!
    await this.startSlot(slot, this.track, MUSIC_FADE)
    this.playing = !slot.el.paused
  }

  pauseMusic(): void {
    this.playing = false
    const fade = MUSIC_FADE * 0.6
    this.slots.forEach((slot) => this.fadeSlot(slot, 0, fade))
    window.setTimeout(
      () => {
        if (this.playing) return
        this.slots.forEach((slot) => slot.el.pause())
      },
      fade * 1000 + 80
    )
  }

  isMusicPlaying(): boolean {
    return this.playing && this.slots.some((slot) => !slot.el.paused)
  }

  setMusicVolume(value: number): void {
    this.volume = Math.min(1, Math.max(0, value))
    this.slots.forEach((slot) => {
      if (!slot.el.paused) slot.el.volume = this.volume
    })
  }

  getMusicVolume(): number {
    return this.volume
  }

  async playTrack(track: AlbumTrack): Promise<void> {
    this.track = track
    if (this.playing) await this.crossfadeTo(track)
    else await this.playMusic()
  }

  async nextTrack(): Promise<void> {
    await this.crossfadeTo(this.pickNext(1))
  }

  async previousTrack(): Promise<void> {
    await this.crossfadeTo(this.pickNext(-1))
  }

  musicProgress(): { id: string; time: number; duration: number } | null {
    const slot = this.slots[this.activeSlot]
    if (!slot?.track) return null
    return {
      id: slot.track.id,
      time: slot.el.currentTime,
      duration: Number.isFinite(slot.el.duration) ? slot.el.duration : 0,
    }
  }

  seekMusic(seconds: number): void {
    const slot = this.slots[this.activeSlot]
    if (slot) slot.el.currentTime = Math.max(0, seconds)
  }

  /* ------------------------------------------------------------------ 内部 */

  private ensureSlots(): void {
    if (this.slots.length > 0) return
    for (let i = 0; i < 2; i++) {
      const el = document.createElement('audio')
      el.preload = 'auto'
      el.volume = 1
      // 刻意不设 crossOrigin：在线流是跨域的，设了就会要求 CORS 头而完全没声音
      this.slots.push({ el, fadeTimer: null, track: null, armed: false })
    }
  }

  private fadeSlot(slot: MusicSlot, target: number, seconds: number): void {
    if (slot.fadeTimer !== null) {
      window.clearInterval(slot.fadeTimer)
      slot.fadeTimer = null
    }
    const from = slot.el.volume
    const steps = Math.max(1, Math.round((seconds * 1000) / 60))
    let step = 0
    slot.fadeTimer = window.setInterval(() => {
      step++
      const k = Math.min(1, step / steps)
      slot.el.volume = Math.min(1, Math.max(0, from + (target - from) * k))
      if (k >= 1 && slot.fadeTimer !== null) {
        window.clearInterval(slot.fadeTimer)
        slot.fadeTimer = null
      }
    }, 60)
  }

  private urlFor(track: AlbumTrack): string | null {
    return resolveTrackUrl(track, this.sourceMode, this.customUrls)
  }

  private async startSlot(slot: MusicSlot, track: AlbumTrack, fade: number): Promise<void> {
    const url = this.urlFor(track)
    if (!url) return
    if (slot.track?.id !== track.id || slot.el.src.indexOf(url) < 0) {
      slot.el.src = url
      slot.track = track
      slot.el.currentTime = 0
    }
    if (!slot.armed) {
      slot.el.addEventListener('error', () => {
        if (!this.playing) return
        this.failed.add(track.id)
        const remaining = this.album.filter((entry) => !this.failed.has(entry.id))
        if (remaining.length === 0) {
          this.playing = false
          window.setTimeout(() => this.failed.clear(), 60_000)
          return
        }
        void this.crossfadeTo(remaining[0] ?? null)
      })
      slot.el.addEventListener('timeupdate', () => this.maybeCrossfade(slot))
      slot.el.addEventListener('ended', () => {
        if (!this.playing) return
        if (this.slots[this.activeSlot] === slot) void this.crossfadeTo(this.pickNext(1))
      })
      slot.armed = true
    }
    try {
      await slot.el.play()
    } catch {
      /* 没有用户手势：autoStart 会在第一次交互时再来一次 */
    }
    this.fadeSlot(slot, 1, fade)
  }

  private maybeCrossfade(slot: MusicSlot): void {
    if (!this.playing) return
    if (this.slots[this.activeSlot] !== slot) return
    const { el } = slot
    if (!Number.isFinite(el.duration) || el.duration <= 0) return
    if (el.duration - el.currentTime <= MUSIC_CROSSFADE) {
      void this.crossfadeTo(this.pickNext(1))
    }
  }

  private async crossfadeTo(track: AlbumTrack | null): Promise<void> {
    if (!track) return
    this.ensureSlots()
    const from = this.slots[this.activeSlot]!
    const nextIndex = 1 - this.activeSlot
    const to = this.slots[nextIndex]!
    this.activeSlot = nextIndex
    this.track = track
    await this.startSlot(to, track, MUSIC_CROSSFADE)
    if (!to.el.paused) this.fadeSlot(from, 0, MUSIC_CROSSFADE)
    window.setTimeout(() => {
      if (this.activeSlot === nextIndex) from.el.pause()
    }, MUSIC_CROSSFADE * 1000 + 200)
  }

  /** 顺序播放为默认；只有用户显式打开随机才随机取另一首 */
  private pickNext(step: 1 | -1): AlbumTrack | null {
    const list = this.album
    if (list.length === 0) return this.track
    if (this.shuffle && list.length > 1) {
      const others = list.filter((entry) => entry.id !== this.track?.id)
      return others[Math.floor(Math.random() * others.length)] ?? list[0] ?? null
    }
    const index = list.findIndex((entry) => entry.id === this.track?.id)
    const next = (index + step + list.length) % list.length
    return list[next] ?? null
  }
}

export const audio = new AudioManager()
