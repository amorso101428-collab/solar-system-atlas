/**
 * 背景音乐曲目表（v8.1）。
 *
 * 专辑：**The Arrow of Time: Soundtrack to "Timelapse of the Future"** — melodysheep
 * （John D. Boswell，2019-03-20 发行，14 首；官方标注授权为
 * Attribution Non Commercial Share Alike）。
 * 来源：https://melodysheep.bandcamp.com/album/the-arrow-of-time-soundtrack-to-timelapse-of-the-future
 *
 * 这里放的是用户提供的两首本体文件（专辑第 3、5 首），
 * 所以 `order` 直接写**专辑里的曲目序号**，播放器默认就按这个顺序排。
 * 播放走 HTMLAudioElement + MediaElementSource：浏览器以流媒体方式按需读取，
 * 不会像 decodeAudioData 那样先把整段 FLAC 解进内存。
 */
export interface BackgroundMusicTrack {
  id: string
  title: string
  /** 相对 public 的路径 */
  url: string
  author?: string
  license?: string
  note?: string
  /** 专辑名（面板上显示） */
  album?: string
  /** 专辑内曲目序号，用于"默认排序播放" */
  order?: number
  /** 时长（秒，取自官方发行信息） */
  duration?: number
  /** 网易云音乐歌曲 id（默认播放源直接用它取外链音源） */
  netease?: number
  /** 官方在线流（带时效 token，可能过期） */
  stream?: string
  /** 官方曲目页 */
  bandcamp?: string
  /** 是否来自用户自己提供的文件 */
  userFile?: boolean
}

/**
 * 播放源（v9.2）。
 *   netease —— 网易云音乐官方外链（**默认**）：`music.163.com/song/media/outer/url?id=…`
 *              会 302 到唱片公司 CDN 的 mp3，跨域可直接播放，且站点里不需要打包音频
 *   stream  —— 官方 Bandcamp 在线流（URL 带时效 token，过期后自动回落到下一首）
 *   custom  —— 用户自己选的文件（File API，浏览器本地映射）或粘贴的自定义直链
 */
export type MusicSourceMode = 'netease' | 'stream' | 'custom'

/** 从 album.json 读进来的整张专辑曲目 */
export interface AlbumTrack {
  id: string
  title: string
  order: number
  duration: number
  file: string
  /** 网易云音乐歌曲 id */
  netease?: number
  bandcamp?: string
  stream?: string | null
  userFile?: boolean
}

export const MUSIC_ALBUM = {
  title: 'The Arrow of Time: Soundtrack to "Timelapse of the Future"',
  artist: 'melodysheep',
  year: 2019,
  url: 'https://melodysheep.bandcamp.com/album/the-arrow-of-time-soundtrack-to-timelapse-of-the-future',
  /** 站内默认播放源（网易云音乐上的同一张专辑） */
  neteaseUrl: 'https://music.163.com/#/album?id=78242870',
  neteaseId: 78242870,
  license: 'Attribution Non Commercial Share Alike',
} as const

export const MUSIC_TRACKS: BackgroundMusicTrack[] = [
  {
    id: 'ether',
    title: 'Ether',
    url: 'audio/music/ether.flac',
    netease: 1355147161,
    author: 'melodysheep',
    license: MUSIC_ALBUM.license,
    album: MUSIC_ALBUM.title,
    order: 3,
    duration: 114.6,
    note: '进站时的初始曲目',
  },
  {
    id: 'afterlife',
    title: 'Afterlife',
    url: 'audio/music/afterlife.flac',
    netease: 1355147162,
    author: 'melodysheep',
    license: MUSIC_ALBUM.license,
    album: MUSIC_ALBUM.title,
    order: 5,
    duration: 51.4,
  },
]

/** 运行时的整张专辑（`public/audio/music/album.json` 的解析结果） */
	export async function loadAlbum(): Promise<AlbumTrack[]> {
  try {
    const response = await fetch('audio/music/album.json')
    if (!response.ok) throw new Error(String(response.status))
    const data = (await response.json()) as { tracks?: AlbumTrack[] }
    const tracks = (data.tracks ?? []).slice().sort((a, b) => a.order - b.order)
    if (tracks.length > 0) return tracks
  } catch {
    /* 清单缺失时退回内置的两首 */
  }
  return MUSIC_TRACKS.map((track, index) => ({
    id: track.id,
    title: track.title,
    order: track.order ?? index + 1,
    duration: track.duration ?? 0,
    file: `/${track.url}`,
    netease: track.netease,
    stream: track.stream ?? null,
    bandcamp: track.bandcamp,
    userFile: track.userFile,
  }))
}

/**
 * 网易云官方外链音源。
 *
 * `song/media/outer/url` 是网易云给外链播放器用的接口：请求它会 302 到
 * 唱片公司 CDN（`*.music.126.net`）上一个**当场签发的 mp3 直链**，
 * 所以不需要在站点里打包任何音频文件，也不会因为直链过期而失效。
 * 实测该 CDN 支持 https，且返回 `Access-Control-Allow-Origin: *`。
 */
export function neteaseOuterUrl(songId: number): string {
  return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`
}

/**
 * 一首曲子按当前播放源解析成可播放的 URL（v9.2）。
 * 返回 null 表示这个源上没有这首——调用方负责回落。
 */
export function resolveTrackUrl(
  track: AlbumTrack,
  mode: MusicSourceMode,
  custom: Map<string, string>
): string | null {
  if (mode === 'custom') {
    const own = custom.get(track.id)
    if (own) return own
    // 没有自定义地址时回落到默认源，避免整首空着
    return track.netease ? neteaseOuterUrl(track.netease) : (track.stream ?? null)
  }
  if (mode === 'netease') return track.netease ? neteaseOuterUrl(track.netease) : null
  return track.stream ?? null
}

/* ------------------------------------------------------------------ 自定义音源
 * 有些网络环境下官方 CDN 可能很慢或不通。这里允许用户给任意一首歌指定
 * **一个能直接播放的音频地址**（网易云 `music.163.com/song/media/outer/url?id=…`、
 * 其它平台的直链、自己服务器上的文件都行），设置会记在浏览器本地。
 */
const URL_STORE_KEY = 'atlas.music.customUrls'

export function loadCustomUrls(): Map<string, string> {
  try {
    const raw = window.localStorage.getItem(URL_STORE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, string>
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

export function saveCustomUrl(trackId: string, url: string): void {
  try {
    const map = Object.fromEntries(loadCustomUrls())
    if (url.trim()) map[trackId] = url.trim()
    else delete map[trackId]
    window.localStorage.setItem(URL_STORE_KEY, JSON.stringify(map))
  } catch {
    /* 无痕模式之类：忽略持久化失败 */
  }
}

/** 专辑播放顺序（默认排序） */
export function albumOrder(): BackgroundMusicTrack[] {
  return [...MUSIC_TRACKS].sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}
