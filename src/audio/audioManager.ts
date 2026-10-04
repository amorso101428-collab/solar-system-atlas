import {
  loadAlbum,
  loadCustomUrls,
  resolveTrackUrl,
  saveCustomUrl,
  type AlbumTrack,
  type MusicSourceMode,
} from './musicTracks'

/** Background music plus gesture-unlocked, rate-limited synthesized interface cues. */
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

  private sfx: AudioContext | null = null
  private sfxEnabled = true
  private hoverMuted = false
  private lastCue = 0
  emit(event: string): void {
    if (!this.sfxEnabled || (event.includes('hover') && this.hoverMuted)) return
    const ctx = this.sfx
    if (!ctx || ctx.state !== 'running') return
    const now = ctx.currentTime
    if (now - this.lastCue < (event.includes('hover') ? 0.12 : 0.04)) return
    this.lastCue = now
    const hover = event.includes('hover')
    const close = /close|off|back/.test(event)
    const focus = /focus|open|change/.test(event)
    const duration = hover ? 0.045 : focus ? 0.22 : 0.10
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(hover ? 0.012 : 0.035, now + 0.007)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    gain.connect(ctx.destination)
    const oscillator = ctx.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(hover ? 1250 : close ? 680 : 420, now)
    oscillator.frequency.exponentialRampToValueAtTime(close ? 240 : focus ? 1350 : 880, now + duration)
    oscillator.connect(gain)
    oscillator.start(now)
    oscillator.stop(now + duration + 0.01)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
  }
  unlock(): void {
    if (!this.sfxEnabled) return
    this.sfx ??= new AudioContext()
    if (this.sfx.state === 'suspended') void this.sfx.resume().catch(() => {})
  }
  setEnabled(value: boolean): void { this.sfxEnabled = value }
  muteHover(value: boolean): void { this.hoverMuted = value }

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

window.addEventListener('pointerdown', () => audio.unlock(), {passive:true})
window.addEventListener('keydown', () => audio.unlock(), {passive:true})
