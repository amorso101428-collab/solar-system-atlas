import { PLANETS } from '../data/planets'
import { audio } from '../audio/audioManager'

/**
 * 进场前的整体预加载（v7.2）。
 *
 * 为什么要它：主页出来之后点"进入图谱"，画面第一次渲染行星、卫星、目录点云——
 * 那一刻要做贴图解码 + 上传 GPU + 编译着色器，于是"卡一下"。
 * 这一版把所有素材在加载页里先走一遍（并且图谱在加载页背后就已经渲染起来了），
 * 用户看到的过渡因此是连续的。
 *
 * 清单不是手写死的：行星 / 卫星贴图从数据里取，音效从 AudioManager 的映射表里取，
 * 这样以后加天体或换音效都不会漏。
 */

export interface BootGroup {
  id: string
  label: string
  labelCn: string
  urls: string[]
}

/** 数据里没有、但着色器要用到的几张补充贴图 */
const EXTRA_TEXTURES = [
  'planets/earth_nightmap-2k.jpg',
  'planets/earth_clouds_nasa-2k.jpg',
  'planets/sun_photosphere-2k.jpg',
  'planets/sun_equirect-2k.jpg',
  'planets/venus_surface-2k.jpg',
].map((path) => `/${path}`)

export function bootGroups(): BootGroup[] {
  const planetUrls = new Set<string>(EXTRA_TEXTURES)
  for (const planet of PLANETS) {
    if (planet.texture) planetUrls.add(`/${planet.texture}`)
    if (planet.ringTexture) planetUrls.add(`/${planet.ringTexture}`)
    for (const moon of planet.moons) {
      if (moon.texture) planetUrls.add(`/${moon.texture}`)
    }
  }

  return [
    {
      id: 'ephemeris',
      label: 'EPHEMERIS',
      labelCn: '星历与轨道',
      urls: ['/data/earth-catalog.json'],
    },
    {
      id: 'textures',
      label: 'SURFACE MAPS',
      labelCn: '天体贴图',
      urls: [...planetUrls].sort(),
    },
    {
      id: 'audio',
      label: 'INTERFACE AUDIO',
      labelCn: '界面音效',
      urls: audio.cueSources(),
    },
  ]
}

export interface BootProgress {
  /** 0…1 */
  ratio: number
  /** 当前组（1 起） */
  groupIndex: number
  groupCount: number
  groupLabel: string
  groupLabelCn: string
  /** 当前组内已完成 / 总数 */
  index: number
  total: number
  /** 正卡在哪一个文件（调试用，界面上只显示组名） */
  current: string
}

/**
 * 按组顺序拉取所有素材，边拉边报进度。
 *
 * 优先读取 `Content-Length` 做**字节级**进度：文件大小差 20 倍的时候，
 * 按"文件个数"报进度会出现长时间停在 87% 这种假死感。
 * 拿不到长度就退回按文件计数（每完成一个文件进一格）。
 */
export async function runPreload(
  onProgress: (progress: BootProgress) => void,
  signal?: { stopped: boolean }
): Promise<void> {
  const groups = bootGroups()
  const totalFiles = groups.reduce((sum, group) => sum + group.urls.length, 0) || 1
  let doneFiles = 0

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g]!
    for (let i = 0; i < group.urls.length; i++) {
      if (signal?.stopped) return
      const url = group.urls[i]!
      const report = (fraction: number) => {
        onProgress({
          ratio: Math.min(1, (doneFiles + fraction) / totalFiles),
          groupIndex: g + 1,
          groupCount: groups.length,
          groupLabel: group.label,
          groupLabelCn: group.labelCn,
          index: i + 1,
          total: group.urls.length,
          current: url,
        })
      }
      report(0)
      try {
        await fetchStreaming(url, (fraction) => report(fraction))
      } catch {
        // 缺一张贴图不该卡住进场：着色器本来就有程序化兜底
        console.warn(`[boot] asset skipped: ${url}`)
      }
      doneFiles++
      report(1)
    }
  }
}

async function fetchStreaming(url: string, onFraction: (fraction: number) => void): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  const length = Number(response.headers.get('Content-Length') ?? '')
  const body = response.body
  if (!body || !Number.isFinite(length) || length <= 0) {
    await response.arrayBuffer()
    onFraction(1)
    return
  }
  const reader = body.getReader()
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    onFraction(Math.min(1, received / length))
  }
  onFraction(1)
}
