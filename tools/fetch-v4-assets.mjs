/**
 * v4 素材抓取（需要联网）。
 *   node tools/fetch-v4-assets.mjs
 *
 * 产出：
 *   public/planets/venus_atmosphere-2k.jpg   金星硫酸云（原来的 venus_surface 是地表雷达图，偏红）
 *   public/planets/sun_photosphere-2k.jpg    SDO HMI 白光日面（真实照片，用来看清米粒组织与黑子）
 *   public/planets/sun_304-2k.jpg            SDO AIA 304（色球层与日珥）
 *   public/planets/sun_193-2k.jpg            SDO AIA 193（日冕结构）
 *
 * 全部来自 NASA SDO / Solar System Scope，公共领域或 CC BY 4.0。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'planets')

const ASSETS = [
  {
    file: 'venus_atmosphere-2k.jpg',
    candidates: ['https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg'],
    credit: 'Solar System Scope (CC BY 4.0)',
  },
  {
    file: 'sun_photosphere-2k.jpg',
    candidates: [
      'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_2048_HMIB.jpg',
      'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_2048_HMIIC.jpg',
    ],
    credit: 'NASA / SDO (HMI) — public domain',
  },
  {
    file: 'sun_304-2k.jpg',
    candidates: ['https://sdo.gsfc.nasa.gov/assets/img/latest/latest_2048_0304.jpg'],
    credit: 'NASA / SDO (AIA 304) — public domain',
  },
  {
    file: 'sun_193-2k.jpg',
    candidates: ['https://sdo.gsfc.nasa.gov/assets/img/latest/latest_2048_0193.jpg'],
    credit: 'NASA / SDO (AIA 193) — public domain',
  },
]

async function fetchWithRetry(url, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 500 * (i + 1)))
    }
  }
  throw lastError
}

async function main() {
  await mkdir(outDir, { recursive: true })
  for (const asset of ASSETS) {
    const target = path.join(outDir, asset.file)
    if (existsSync(target)) {
      console.log(`  skip ${asset.file}`)
      continue
    }
    let done = false
    for (const url of asset.candidates) {
      try {
        const response = await fetchWithRetry(url)
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length < 20_000) throw new Error('file too small')
        await writeFile(target, buffer)
        console.log(`  ok   ${asset.file}  ${(buffer.length / 1024).toFixed(0)} KB`)
        done = true
        break
      } catch (error) {
        console.log(`  try  ${asset.file}: ${error.message}`)
      }
    }
    if (!done) console.log(`  fail ${asset.file}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
