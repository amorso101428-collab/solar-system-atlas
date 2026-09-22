/**
 * 补充任务影像（需要联网）。
 *   node tools/fetch-more-images.mjs
 *
 * 只为"还没有图"的对象抓一张 NASA Image and Video Library 的公共领域图片，
 * 并刷新 src/data/images.available.ts。已经存在的文件不会被覆盖。
 */
import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const targetDir = path.join(root, 'public', 'images', 'objects')

/** 每个条目：[文件 id, NASA 图库查询词] */
const QUERIES = [
  ['viking-1', 'Viking 1 lander Mars'],
  ['mars-global-surveyor', 'Mars Global Surveyor spacecraft'],
  ['mars-pathfinder', 'Mars Pathfinder Sojourner rover'],
  ['spirit', 'Mars Exploration Rover Spirit'],
  ['opportunity', 'Mars Exploration Rover Opportunity'],
  ['insight', 'InSight lander Mars'],
  ['hope', 'Hope Mars mission UAE'],
  ['exomars-tgo', 'ExoMars Trace Gas Orbiter'],
  ['mariner-10', 'Mariner 10 spacecraft Mercury'],
  ['magellan', 'Magellan spacecraft Venus'],
  ['venus-express', 'Venus Express spacecraft'],
  ['huygens', 'Huygens probe Titan'],
  ['near-shoemaker', 'NEAR Shoemaker asteroid Eros'],
  ['stardust', 'Stardust comet sample return'],
  ['hayabusa', 'Hayabusa asteroid Itokawa'],
  ['ulysses', 'Ulysses solar probe'],
  ['stereo-a', 'STEREO solar observatory'],
  ['sdo', 'Solar Dynamics Observatory spacecraft'],
  ['wind', 'Wind spacecraft solar wind'],
  ['ace', 'Advanced Composition Explorer spacecraft'],
  ['deep-impact', 'Deep Impact comet mission'],
  ['herschel', 'Herschel space observatory'],
  ['planck', 'Planck space observatory'],
  ['europa-clipper', 'Europa Clipper spacecraft'],
  ['kepler', 'Kepler space telescope'],
  ['tess', 'TESS planet hunter'],
  ['gaia', 'Gaia star surveyor ESA'],
  ['spitzer', 'Spitzer Space Telescope'],
  ['neowise', 'NEOWISE asteroid hunter'],
  ['swift', 'Swift gamma ray burst observatory'],
  ['fermi', 'Fermi Gamma-ray Space Telescope'],
  ['xmm-newton', 'XMM-Newton observatory'],
  ['cheops', 'CHEOPS exoplanet satellite'],
  ['goes-16', 'GOES-16 weather satellite'],
  ['himawari-9', 'Himawari weather satellite'],
  ['suomi-npp', 'Suomi NPP satellite'],
  ['landsat-8', 'Landsat 8 satellite'],
  ['oco-2', 'Orbiting Carbon Observatory 2'],
  ['sentinel-1a', 'Sentinel-1 radar satellite ESA'],
  ['sentinel-2a', 'Sentinel-2 satellite ESA'],
  ['jason-3', 'Jason-3 ocean altimetry'],
  ['icesat-2', 'ICESat-2 laser altimeter'],
  ['grace-fo', 'GRACE Follow-On satellites'],
  ['swot', 'SWOT satellite water'],
  ['galileo-nav', 'Galileo navigation satellite'],
  ['beidou-3', 'BeiDou navigation satellite'],
  ['glonass-k', 'GLONASS-K satellite'],
  ['iridium-next', 'Iridium NEXT satellite'],
  ['starlink', 'Starlink satellites orbit'],
  ['sputnik-2', 'Sputnik 2 Laika'],
  ['echo-1', 'Echo 1 satellite balloon'],
  ['vostok-1', 'Vostok 1 Gagarin'],
  ['friendship-7', 'Friendship 7 John Glenn'],
  ['voskhod-2', 'Voskhod 2 Leonov spacewalk'],
  ['skylab', 'Skylab space station'],
  ['salyut-1', 'Salyut 1 space station'],
  ['syncom-3', 'Syncom 3 satellite'],
  ['intelsat-1', 'Intelsat I Early Bird'],
  ['molniya-1', 'Molniya communications satellite'],
  ['iue', 'International Ultraviolet Explorer'],
  ['iras', 'Infrared Astronomical Satellite'],
  ['cobe', 'COBE cosmic background explorer'],
  ['compton-gro', 'Compton Gamma Ray Observatory'],
  ['ers-1', 'ERS-1 satellite ESA'],
  ['topex-poseidon', 'TOPEX Poseidon satellite'],
  ['aqua', 'Aqua satellite NASA'],
  ['aura', 'Aura satellite NASA'],
  ['luna-1', 'Luna 1 spacecraft'],
  ['ranger-7', 'Ranger 7 Moon'],
  ['surveyor-1', 'Surveyor 1 Moon lander'],
  ['luna-16', 'Luna 16 sample return'],
  ['change-1', "Chang'e 1 lunar orbiter"],
  ['chandrayaan-1', 'Chandrayaan-1 lunar orbiter'],
  ['grail', 'GRAIL lunar mission'],
  ['capstone', 'CAPSTONE lunar cubesat'],
  // 第二轮：第一轮没找到的换一组查询词
  ['mars-global-surveyor', 'Mars Global Surveyor aerobraking'],
  ['hope', 'Emirates Mars Mission'],
  ['hayabusa', 'Hayabusa spacecraft JAXA'],
  ['ulysses', 'Ulysses spacecraft Jupiter'],
  ['gaia', 'Gaia spacecraft Milky Way map'],
  ['cheops', 'CHEOPS telescope satellite'],
  ['himawari-9', 'Himawari-8 satellite'],
  ['glonass-k', 'GLONASS satellite'],
  ['starlink', 'satellites low Earth orbit constellation'],
  ['sputnik-2', 'Laika Sputnik'],
  ['voskhod-2', 'Leonov first spacewalk'],
  ['intelsat-1', 'Early Bird communications satellite'],
  ['molniya-1', 'Molniya orbit satellite'],
  ['change-1', 'Chang E lunar orbiter China moon'],
  ['chandrayaan-1', 'Chandrayaan lunar orbiter India'],
  ['capstone', 'lunar Gateway orbit cubesat'],
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
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)))
    }
  }
  throw lastError
}

async function resolveNASA(query) {
  const searchUrl = `https://images-api.nasa.gov/search?media_type=image&page_size=6&q=${encodeURIComponent(query)}`
  const search = await fetchWithRetry(searchUrl).then((response) => response.json())
  for (const item of search?.collection?.items ?? []) {
    const assetsUrl = item.href
    if (!assetsUrl) continue
    try {
      const assets = await fetchWithRetry(assetsUrl).then((response) => response.json())
      const files = Array.isArray(assets) ? assets : []
      const pick =
        files.find((file) => file.endsWith('~medium.jpg')) ??
        files.find((file) => file.endsWith('~small.jpg')) ??
        files.find((file) => file.endsWith('~orig.jpg'))
      if (pick) return pick
    } catch {
      continue
    }
  }
  return null
}

async function refreshAvailable() {
  const files = await readdir(targetDir)
  const ids = files
    .filter((name) => name.endsWith('.jpg'))
    .map((name) => path.basename(name, '.jpg'))
    .sort()
  const body =
    '// 由 tools/fetch-more-images.mjs 生成：只有真正存在任务影像的对象才显示图片区。\n' +
    'export const AVAILABLE_IMAGES = new Set<string>([\n' +
    ids.map((id) => `  '${id}',`).join('\n') +
    '\n])\n'
  await writeFile(path.join(root, 'src', 'data', 'images.available.ts'), body, 'utf8')
  return ids.length
}

async function main() {
  await mkdir(targetDir, { recursive: true })
  let ok = 0
  let skip = 0
  const failed = []

  for (const [id, query] of QUERIES) {
    const target = path.join(targetDir, `${id}.jpg`)
    if (existsSync(target)) {
      skip++
      continue
    }
    try {
      const url = await resolveNASA(query)
      if (!url) throw new Error('no image found')
      const response = await fetchWithRetry(url)
      const buffer = Buffer.from(await response.arrayBuffer())
      if (buffer.length < 8_000) throw new Error('image too small')
      await writeFile(target, buffer)
      ok++
      console.log(`  ok   ${id}`)
    } catch (error) {
      failed.push(`${id}: ${error.message}`)
      console.log(`  fail ${id}: ${error.message}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  const total = await refreshAvailable()
  console.log(`\n新增 ${ok} 张 / 跳过 ${skip} 张 / 失败 ${failed.length} 张 / 现有 ${total} 张`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
