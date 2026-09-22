/**
 * 一次性素材抓取脚本（需要联网）。
 *   node tools/fetch-assets.mjs
 *
 * 产出：
 *   public/fonts/*.woff2               自托管字体
 *   public/textures/{earth,mars}-2k.jpg 行星贴图（NASA / CC BY）
 *   public/images/objects/<id>.jpg      每个对象的 NASA 官方任务图
 *   src/data/images.generated.ts        图片署名清单（不给来源就不算完成）
 *
 * 全部素材均为公共领域或署名许可，署名信息写入生成文件并被档案面板引用。
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OBJECTS_SOURCE = path.join(root, 'src', 'data', 'objects.ts')

const FONTS = [
  ['ibm-plex-mono-400.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-400-normal.woff2'],
  ['ibm-plex-mono-500.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-500-normal.woff2'],
  ['inter-300.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-300-normal.woff2'],
  ['inter-400.woff2', 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff2'],
]

const TEXTURES = [
  {
    file: 'earth-2k.jpg',
    dir: 'textures',
    candidates: [
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57752/land_ocean_ice_2048.jpg',
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
    ],
    credit: 'NASA Visible Earth — Blue Marble (public domain)',
  },
  {
    file: 'mars-2k.jpg',
    dir: 'textures',
    candidates: [
      'https://www.solarsystemscope.com/textures/download/2k_mars.jpg',
      'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x5400x2700.jpg',
    ],
    credit: 'Solar System Scope (CC BY 4.0) / NASA',
  },
  // Solar System Scope 的行星贴图（CC BY 4.0）：水星/金星/地球/木星/土星/天王星/海王星/月球/太阳
  ...['mercury', 'venus_surface', 'earth_daymap', 'earth_nightmap', 'earth_clouds', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon', 'sun'].map(
    (name) => ({
      file: `${name}-2k.jpg`,
      dir: 'planets',
      candidates: [`https://www.solarsystemscope.com/textures/download/2k_${name}.jpg`],
      credit: 'Solar System Scope (CC BY 4.0)',
    })
  ),
  {
    file: 'saturn-ring-2k.png',
    dir: 'planets',
    candidates: ['https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png'],
    credit: 'Solar System Scope (CC BY 4.0)',
  },
]

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url, options)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)))
    }
  }
  throw lastError
}

async function download(url) {
  const response = await fetchWithRetry(url)
  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer
}

async function save(relativePath, buffer) {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, buffer)
}

/* ------------------------------------------------------------------ 对象 ID */

async function readObjectIds() {
  const source = await import('node:fs').then((fs) => fs.promises.readFile(OBJECTS_SOURCE, 'utf8'))
  const ids = []
  const idPattern = /^\s{4}id: '([^']+)',/gm
  let match
  while ((match = idPattern.exec(source))) ids.push(match[1])
  // 查询词：从 imageQuery 字段读取
  const queryPattern = /^\s{4}id: '([^']+)',[\s\S]*?imageQuery: '([^']+)',/gm
  const queries = new Map()
  while ((match = queryPattern.exec(source))) queries.set(match[1], match[2])
  return { ids, queries }
}

/* --------------------------------------------------------- NASA 图像接口 */

async function resolveNasaImage(query) {
  const searchUrl = `https://images-api.nasa.gov/search?media_type=image&page_size=8&q=${encodeURIComponent(query)}`
  const search = await fetchWithRetry(searchUrl).then((response) => response.json())
  const items = search?.collection?.items ?? []
  for (const item of items) {
    const data = item.data?.[0]
    const collectionUrl = item.href
    if (!data || !collectionUrl) continue
    try {
      const assets = await fetchWithRetry(collectionUrl).then((response) => response.json())
      const files = Array.isArray(assets) ? assets : []
      const pick =
        files.find((file) => file.endsWith('~medium.jpg')) ??
        files.find((file) => file.endsWith('~small.jpg')) ??
        files.find((file) => file.endsWith('~orig.jpg')) ??
        files.find((file) => file.endsWith('.jpg'))
      if (!pick) continue
      return {
        imageUrl: pick,
        title: data.title ?? '',
        center: data.center ?? '',
        nasaId: data.nasa_id ?? '',
        date: data.date_created ?? '',
      }
    } catch {
      continue
    }
  }
  return null
}

/* ------------------------------------------------------------------- main */

async function main() {
  const report = { fonts: 0, textures: 0, images: 0, failedImages: [] }

  console.log('· fonts')
  for (const [file, url] of FONTS) {
    const target = path.join(root, 'public', 'fonts', file)
    if (existsSync(target)) {
      report.fonts++
      continue
    }
    try {
      await save(path.join('public', 'fonts', file), await download(url))
      report.fonts++
      console.log(`  ok  ${file}`)
    } catch (error) {
      console.log(`  fail ${file}: ${error.message}`)
    }
  }

  console.log('· textures')
  for (const texture of TEXTURES) {
    const dir = texture.dir ?? 'textures'
    const target = path.join(root, 'public', dir, texture.file)
    if (existsSync(target)) {
      report.textures++
      continue
    }
    for (const candidate of texture.candidates) {
      try {
        const buffer = await download(candidate)
        if (buffer.length < 40_000) throw new Error('file too small')
        await save(path.join('public', dir, texture.file), buffer)
        report.textures++
        console.log(`  ok  ${texture.file}  ${(buffer.length / 1024).toFixed(0)} KB  ← ${candidate}`)
        break
      } catch (error) {
        console.log(`  try ${texture.file}: ${error.message}`)
      }
    }
  }

  console.log('· mission images')
  const { ids, queries } = await readObjectIds()
  const credits = {}

  for (const id of ids) {
    const target = path.join(root, 'public', 'images', 'objects', `${id}.jpg`)
    if (existsSync(target)) {
      report.images++
      continue
    }
    const query = queries.get(id) ?? id.replace(/-/g, ' ')
    try {
      const resolved = await resolveNasaImage(query)
      if (!resolved) throw new Error('no image found')
      const buffer = await download(resolved.imageUrl)
      if (buffer.length < 8_000) throw new Error('image too small')
      await save(path.join('public', 'images', 'objects', `${id}.jpg`), buffer)
      credits[id] = {
        title: resolved.title,
        center: resolved.center,
        nasaId: resolved.nasaId,
        detailUrl: resolved.nasaId ? `https://images.nasa.gov/details/${resolved.nasaId}` : '',
      }
      report.images++
      console.log(`  ok  ${id}  ${(buffer.length / 1024).toFixed(0)} KB  ${resolved.center ?? ''}`)
    } catch (error) {
      report.failedImages.push(`${id}: ${error.message}`)
      console.log(`  fail ${id}: ${error.message}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 220))
  }

  const generated = `// 由 tools/fetch-assets.mjs 生成，请勿手工编辑。
// 图片均来自 NASA Image and Video Library（公共领域），署名信息见下。

export interface ImageCredit {
  title: string
  center: string
  nasaId: string
  detailUrl: string
}

export const IMAGE_CREDITS: Record<string, ImageCredit> = ${JSON.stringify(credits, null, 2)}

export const TEXTURE_CREDITS = ${JSON.stringify(
    TEXTURES.map((texture) => ({ file: texture.file, credit: texture.credit })),
    null,
    2
  )}
`
  await save(path.join('src', 'data', 'images.generated.ts'), Buffer.from(generated, 'utf8'))

  console.log('\n完成：', report)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
