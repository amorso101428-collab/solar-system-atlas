import { useEffect, useMemo, useRef, useState } from 'react'
import { audio } from '../audio/audioManager'
import {
  loadAlbum,
  MUSIC_ALBUM,
  type AlbumTrack,
  type MusicSourceMode,
} from '../audio/musicTracks'
import { useAtlasStore } from '../state/atlasStore'

/**
 * 音乐厅（v9.2）—— 专门的音乐播放界面。
 *
 * 左边是整张专辑的曲目表（14 首，点哪首放哪首），右边是当前曲目、
 * 进度、上一首/下一首、随机与音量；下面一排是**播放源**：
 *
 *   网易云音乐  官方外链音源（默认）：站点不打包音频，直连唱片公司 CDN
 *   官方流      Bandcamp 的 mp3 流（URL 带时效 token，过期会跳到下一首）
 *   自选文件    你自己挑的音频文件或粘贴的直链（只在浏览器本地映射，不上传）
 *
 * 播放本身走 HTMLAudioElement，浏览器按需流式读取；换曲有 3.2s 交叉淡入淡出。
 */
const SOURCES: Array<{ id: MusicSourceMode; label: string; hint: string }> = [
  { id: 'netease', label: '网易云音乐', hint: '官方外链音源，直接播放' },
  { id: 'stream', label: '官方在线流', hint: '直接用专辑官方音源' },
  { id: 'custom', label: '自定义音源', hint: '粘贴直链或选本机文件' },
]

export function MusicHall() {
  const open = useAtlasStore((state) => state.musicPanelOpen)
  const closeHall = useAtlasStore((state) => state.openMusicPanel)
  const [tracks, setTracks] = useState<AlbumTrack[]>([])
  const [currentId, setCurrentId] = useState<string>('ether')
  const [playing, setPlaying] = useState(() => audio.isMusicPlaying())
  const [shuffle, setShuffle] = useState(() => audio.isShuffle())
  const [volume, setVolume] = useState(() => Math.round(audio.getMusicVolume() * 100))
  const [source, setSource] = useState<MusicSourceMode>(() => audio.getMusicSourceMode())
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [customCount, setCustomCount] = useState(0)
  const [customUrl, setCustomUrl] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 打开时装载整张专辑清单
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void loadAlbum().then((list) => {
      if (cancelled) return
      setTracks(list)
      audio.setAlbum(list)
      const track = audio.getMusicTrack()
      if (track) setCurrentId(track.id)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  // 进度与状态轮询（500ms，足够顺滑又不至于每帧重渲染）
  useEffect(() => {
    if (!open) return
    const timer = window.setInterval(() => {
      const now = audio.musicProgress()
      if (now) {
        setCurrentId(now.id)
        setTime(now.time)
        setDuration(now.duration)
      }
      setPlaying(audio.isMusicPlaying())
    }, 500)
    return () => window.clearInterval(timer)
  }, [open])

  useEffect(() => {
    audio.setMusicVolume(volume / 100)
  }, [volume])

  // 切到某一首时，把已经设置过的自定义地址回显出来
  useEffect(() => {
    setCustomUrl(audio.customFiles().get(currentId) ?? '')
  }, [currentId])

  const current = useMemo(
    () => tracks.find((track) => track.id === currentId) ?? tracks[0] ?? null,
    [currentId, tracks]
  )

  if (!open) return null

  const totalLabel = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
  const timeLabel = `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`

  return (
    <div className="hall">
      <div className="hall__frame" aria-hidden />

      <header className="hall__head">
        <div>
          <div className="hall__kicker">MUSIC HALL · 音乐厅</div>
          <h2>{MUSIC_ALBUM.title}</h2>
          <p>
            {MUSIC_ALBUM.artist} · {MUSIC_ALBUM.year} ·{' '}
            <a href={MUSIC_ALBUM.neteaseUrl} target="_blank" rel="noreferrer">
              网易云专辑
            </a>{' '}
            ·{' '}
            <a href={MUSIC_ALBUM.url} target="_blank" rel="noreferrer">
              官方专辑页
            </a>{' '}
            · {MUSIC_ALBUM.license}
          </p>
        </div>
        <button
          type="button"
          className="hall__close"
          onPointerEnter={() => audio.emit('object.hover')}
          onClick={() => {
            audio.emit('menu.close')
            closeHall(false)
          }}
        >
          关闭 ✕
        </button>
      </header>

      <div className="hall__body">
        <ol className="hall__tracks">
          {tracks.map((track) => (
            <li key={track.id}>
              <button
                type="button"
                className="hall__track"
                aria-current={track.id === currentId}
                onPointerEnter={() => audio.emit('object.hover')}
                onClick={async () => {
                  audio.emit('button.click')
                  setCurrentId(track.id)
                  await audio.playTrack(track)
                  setPlaying(audio.isMusicPlaying())
                }}
              >
                <b>{String(track.order).padStart(2, '0')}</b>
                <span className="hall__title">{track.title}</span>
                <em className="hall__badges">
                  {track.netease ? '网易云' : track.userFile ? 'FLAC' : 'MP3'}
                  {track.stream ? ' · 在线' : ''}
                </em>
                <em className="hall__time">
                  {Math.floor(track.duration / 60)}:
                  {String(track.duration % 60).padStart(2, '0')}
                </em>
              </button>
            </li>
          ))}
          {tracks.length === 0 ? <li className="hall__empty">正在读取专辑清单…</li> : null}
        </ol>

        <section className="hall__now">
          <div className="hall__kicker">NOW PLAYING</div>
          <h3>{current?.title ?? '—'}</h3>
          <p>
            {current ? `第 ${current.order} 首 · ${Math.floor(current.duration / 60)}:${String(current.duration % 60).padStart(2, '0')}` : ''}
          </p>

          <div className="hall__seek">
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(duration))}
              value={Math.floor(time)}
              onChange={(event) => {
                const next = Number(event.target.value)
                setTime(next)
                audio.seekMusic(next)
              }}
            />
            <div className="hall__seek-meta">
              <span>{timeLabel}</span>
              <span>{totalLabel}</span>
            </div>
          </div>

          <div className="hall__controls">
            <button
              type="button"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={async () => {
                audio.emit('button.click')
                await audio.previousTrack()
                setPlaying(audio.isMusicPlaying())
              }}
            >
              ◀◀ 上一首
            </button>
            <button
              type="button"
              className="hall__play"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={async () => {
                audio.emit('button.click')
                if (playing) {
                  audio.pauseMusic()
                  setPlaying(false)
                } else {
                  await audio.playMusic()
                  setPlaying(audio.isMusicPlaying())
                }
              }}
            >
              {playing ? '❚❚ 暂停' : '▶ 播放'}
            </button>
            <button
              type="button"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={async () => {
                audio.emit('button.click')
                await audio.nextTrack()
                setPlaying(audio.isMusicPlaying())
              }}
            >
              下一首 ▶▶
            </button>
            <button
              type="button"
              aria-pressed={shuffle}
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={() => {
                const next = !shuffle
                audio.setShuffle(next)
                setShuffle(next)
                audio.emit(next ? 'toggle.on' : 'toggle.off')
              }}
            >
              {shuffle ? '随机 ✓' : '顺序播放'}
            </button>
          </div>

          <div className="hall__row">
            <span>音量</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
            />
          </div>

          <div className="hall__kicker hall__kicker--gap">PLAYBACK SOURCE · 播放源</div>
          <div className="hall__sources">
            {SOURCES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={source === entry.id}
                onPointerEnter={() => audio.emit('object.hover')}
                onClick={async () => {
                  audio.emit('button.click')
                  audio.setMusicSourceMode(entry.id)
                  setSource(entry.id)
                  if (entry.id === 'custom' && customCount === 0) fileInputRef.current?.click()
                  // 正在播放时，用新播放源把当前这首重新拉起来
                  if (audio.isMusicPlaying() && current) await audio.playTrack(current)
                }}
              >
                <b>{entry.label}</b>
                <em>{entry.hint}</em>
              </button>
            ))}
          </div>
          <div className="hall__row">
            <span>音源地址</span>
            <input
              type="text"
              className="hall__urlinput"
              placeholder="粘贴一个能直接播放的音频直链，应用到当前曲目"
              value={customUrl}
              onChange={(event) => setCustomUrl(event.target.value)}
            />
            <button
              type="button"
              className="hall__mini"
              onPointerEnter={() => audio.emit('object.hover')}
              onClick={async () => {
                if (!current) return
                audio.emit('button.click')
                audio.setCustomUrl(current.id, customUrl)
                audio.setMusicSourceMode('custom')
                setSource('custom')
                await audio.playTrack(current)
                setPlaying(audio.isMusicPlaying())
              }}
            >
              应用
            </button>
          </div>
          <div className="hall__row">
            <span>本机文件</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                files.forEach((file, index) => {
                  const track = tracks[index]
                  if (track) audio.setCustomFile(track.id, file)
                })
                setCustomCount(files.length)
                audio.setMusicSourceMode('custom')
                setSource('custom')
              }}
            />
            <em>{customCount > 0 ? `${customCount} 个文件` : '未选择'}</em>
          </div>

          <p className="hall__note">
            进站即自动播放，按专辑顺序接续；默认走网易云音乐官方外链音源，音频文件不随站点分发。
            封面、曲目与版权归 melodysheep 所有（CC BY-NC-SA，非商业使用）。
          </p>
        </section>
      </div>
    </div>
  )
}
