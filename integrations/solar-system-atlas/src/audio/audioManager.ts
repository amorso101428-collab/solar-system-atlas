import {
  loadAlbum,
  loadCustomUrls,
  resolveTrackUrl,
  saveCustomUrl,
  type AlbumTrack,
  type MusicSourceMode,
} from './musicTracks'
import { initialMusicEnabled } from './musicVisit'

/** Background music plus gesture-unlocked, rate-limited synthesized interface cues. */
const MUSIC_FADE = 0.9
/** 换曲的交叉淡入淡出时长（秒） */
const MUSIC_CROSSFADE = 2.4

interface MusicSlot {
  el: HTMLAudioElement
  fadeTimer: number | null
  track: AlbumTrack | null
  armed: boolean
  generation: number
}

export class AudioManager {
  private musicEnabled = initialMusicEnabled()
  private musicEpoch = 0
  private automaticCleanup: (()=>void) | null = null
  private contextTrack: AlbumTrack | null = null
  private backgroundTrack: AlbumTrack | null = null
  private contextRevision = 0
  private contextPlayToEnd = false
  private transitionRevision = 0
  private musicError = false
  getContextTrack(): AlbumTrack | null { return this.contextTrack }
  hasMusicError(): boolean { return this.musicError }
  private notifyTrack(): void { window.dispatchEvent(new Event('atlas-music-track-change')) }
  /** Context changes select a song, but never override the user's mute. */
  async setContextTrack(track: AlbumTrack | null, finishCurrent=false): Promise<void> {
    // Leaving an information card must not cut a full-song Easter egg short.
    // A different explicitly triggered song or the mute button can interrupt it.
    if(!track && finishCurrent && this.contextTrack && !this.musicError) return
    if(this.contextTrack?.id === track?.id) return
    const revision=++this.contextRevision
    if(track && !this.contextTrack) this.backgroundTrack=this.track
    this.contextTrack=track
    this.contextPlayToEnd=!!track&&finishCurrent
    let next=track ?? this.backgroundTrack
    if(!next) { await this.ensureAlbum(); next=this.album[0] ?? null }
    if(revision!==this.contextRevision) return
    this.musicEpoch++
    this.track=next
    this.musicError=false
    this.notifyTrack()
    if(!this.musicEnabled || !next) return
    if(this.isMusicPlaying()) await this.crossfadeTo(next)
    else await this.playMusic()
  }
  isMusicEnabled(): boolean { return this.musicEnabled }
  private rememberMusic(value:boolean): void {
    this.musicEnabled=value
    window.dispatchEvent(new Event('atlas-music-change'))
  }
  async setMusicEnabled(value:boolean): Promise<void> {
    if(value) await this.playMusic()
    else this.pauseMusic()
  }

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
    if (!this.contextTrack && (!this.track || !tracks.some((entry) => entry.id === this.track?.id))) {
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

  /** Start enabled on each visit; retry on the first gesture if autoplay blocks. */
  autoStart(): () => void {
    this.automaticCleanup?.()
    if(!this.musicEnabled) return ()=>{}
    const attempt=()=>{if(this.musicEnabled) void this.playMusic().then(()=>{if(this.isMusicPlaying())cleanup()})}
    const cleanup=()=>{window.removeEventListener('pointerdown',attempt);window.removeEventListener('keydown',attempt)}
    this.automaticCleanup=cleanup
    window.addEventListener('pointerdown',attempt)
    window.addEventListener('keydown',attempt)
    attempt()
    return cleanup
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
    this.rememberMusic(true)
    const epoch=this.musicEpoch
    if (!this.track) await this.ensureAlbum()
    if (!this.track || !this.musicEnabled || epoch!==this.musicEpoch) return
    if (this.isMusicPlaying()) return
    this.ensureSlots()
    const slot = this.slots[this.activeSlot]!
    await this.startSlot(slot, this.track, MUSIC_FADE)
    if(epoch!==this.musicEpoch) return
    this.playing = this.musicEnabled && epoch===this.musicEpoch && !slot.el.paused
    if(!this.musicEnabled) this.stopSlot(slot,'muted')
    this.notifyTrack()
  }

  pauseMusic(): void {
    this.rememberMusic(false)
    this.musicEpoch++
    this.automaticCleanup?.()
    this.playing = false
    const fade = MUSIC_FADE * 0.6
    this.slots.forEach((slot) => this.fadeSlot(slot, 0, fade))
    window.setTimeout(
      () => {
        if (this.musicEnabled) return
        this.slots.forEach((slot) => this.stopSlot(slot,'muted'))
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
      el.preload = 'metadata'
      el.volume = 1
      el.hidden = true
      el.className = 'atlas-audio'
      document.body?.appendChild(el)
      // 刻意不设 crossOrigin：在线流是跨域的，设了就会要求 CORS 头而完全没声音
      this.slots.push({ el, fadeTimer: null, track: null, armed: false, generation: 0 })
    }
  }

  private stopSlot(slot:MusicSlot,reason:string):void {
    if(slot.el.dataset) slot.el.dataset.musicPauseReason=reason
    slot.el.pause()
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
    if(!this.musicEnabled) return
    const epoch=this.musicEpoch
    const generation=++slot.generation
    const fullSong=this.contextPlayToEnd && this.contextTrack?.id===track.id
    if(slot.fadeTimer!==null) { window.clearInterval(slot.fadeTimer); slot.fadeTimer=null }
    const url = this.urlFor(track)
    if (!url) return
    if (slot.track?.id !== track.id || slot.el.src.indexOf(url) < 0) {
      this.stopSlot(slot,'new-source')
      if(slot.fadeTimer!==null) { window.clearInterval(slot.fadeTimer); slot.fadeTimer=null }
      slot.el.volume=0
      slot.el.src = url
      slot.track = track
      slot.el.currentTime = 0
    }
    if (!slot.armed) {
      slot.el.addEventListener('error', () => {
        if(this.slots[this.activeSlot]!==slot) return
        if(this.contextTrack) { this.musicError=true; this.playing=false; this.slots.forEach(s=>{if(s.fadeTimer!==null)window.clearInterval(s.fadeTimer);s.fadeTimer=null;this.stopSlot(s,'source-error')});this.notifyTrack();return }
        if (!this.playing) return
        if(slot.track) this.failed.add(slot.track.id)
        const remaining = this.album.filter((entry) => !this.failed.has(entry.id))
        if (remaining.length === 0) {
          this.playing = false
          window.setTimeout(() => this.failed.clear(), 60_000)
          return
        }
        void this.crossfadeTo(remaining[0] ?? null)
      })
      slot.el.addEventListener('playing',()=>{if(slot.el.dataset)slot.el.dataset.musicPauseReason='';})
      slot.el.addEventListener('pause',()=>{if(slot.el.dataset)slot.el.dataset.musicPausedAt=String(slot.el.currentTime);})
      slot.el.addEventListener('timeupdate', () => this.maybeCrossfade(slot))
      slot.el.addEventListener('ended', () => {
        if (!this.playing) return
        if(this.slots[this.activeSlot]===slot && this.contextTrack && this.contextPlayToEnd){
          this.playing=false
          void this.setContextTrack(null)
          return
        }
        if (this.slots[this.activeSlot] === slot) void this.crossfadeTo(this.pickNext(1))
      })
      slot.armed = true
    }
    if(slot.el.ended) slot.el.currentTime=0
    // Start an explicit full-song choice audibly within its user gesture.
    // Safari may suspend playback when a silent start is unmuted by a timer.
    if(fullSong) slot.el.volume=this.volume
    try {
      await slot.el.play()
    } catch {
      /* 没有用户手势：autoStart 会在第一次交互时再来一次 */
    }
    if(generation!==slot.generation) return
    if(!this.musicEnabled || epoch!==this.musicEpoch){this.stopSlot(slot,'cancelled-start');return}
    this.musicError=!!slot.el.error
    if(!fullSong) this.fadeSlot(slot, this.volume, fade)
  }

  private maybeCrossfade(slot: MusicSlot): void {
    if(this.contextTrack && this.contextPlayToEnd) return
    if (!this.playing) return
    if (this.slots[this.activeSlot] !== slot) return
    const { el } = slot
    if (!Number.isFinite(el.duration) || el.duration <= 0) return
    if (el.duration - el.currentTime <= MUSIC_CROSSFADE) {
      void this.crossfadeTo(this.pickNext(1))
    }
  }

  private async crossfadeTo(track: AlbumTrack | null): Promise<void> {
    if (!track || !this.musicEnabled) return
    this.ensureSlots()
    const from = this.slots[this.activeSlot]!
    const epoch=this.musicEpoch
    const transition=++this.transitionRevision,fromGeneration=from.generation
    const nextIndex = 1 - this.activeSlot
    const to = this.slots[nextIndex]!
    this.activeSlot = nextIndex
    this.track = track
    await this.startSlot(to, track, MUSIC_CROSSFADE)
    if(epoch!==this.musicEpoch || this.activeSlot!==nextIndex || transition!==this.transitionRevision) return
    this.playing=this.musicEnabled&&!to.el.paused
    this.notifyTrack()
    if (!to.el.paused) this.fadeSlot(from, 0, MUSIC_CROSSFADE)
    window.setTimeout(() => {
      if (this.activeSlot === nextIndex && epoch===this.musicEpoch && transition===this.transitionRevision && fromGeneration===from.generation) this.stopSlot(from,'retired-transition')
    }, MUSIC_CROSSFADE * 1000 + 200)
  }

  /** 顺序播放为默认；只有用户显式打开随机才随机取另一首 */
  private pickNext(step: 1 | -1): AlbumTrack | null {
    if(this.contextTrack) return this.contextTrack
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
