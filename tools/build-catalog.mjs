/**
 * 抓取真实在轨目录（CelesTrak），解析 TLE，写成图谱可用的紧凑数据。
 *   node tools/build-catalog.mjs
 *
 * 为什么不在浏览器里跑 SGP4：
 *   一万多个对象每帧做 SGP4 太贵。这里只导出平均轨道要素，
 *   轨道推进放到顶点着色器里算（圆形近似 + 正确倾角/升交点），
 *   视觉上足够真实，而且完全不占 CPU。
 *
 * 产出：public/data/earth-catalog.json
 *   { generatedAt, source, count, 【a, e, i, raan, argp, ma, n】扁平数组（已换算成图谱尺度） }
 */

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle'
const MU = 398600.4418 // km^3/s^2
const EARTH_RADIUS_KM = 6371
const EARTH_RADIUS_ATLAS = 0.27 // 与 planets.ts 里地球的显示半径一致

/** 高度 → 图谱半径：对数压缩，让 LEO 到 GEO 都看得见（有意夸张，界面会标注 NOT TO SCALE） */
function altitudeToAtlasRadius(altitudeKm) {
  const ratio = 1 + 0.62 * Math.log10(1 + Math.max(altitudeKm, 100) / 250)
  return EARTH_RADIUS_ATLAS * ratio
}

function parseTle(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd())
  const rows = []
  for (let i = 0; i + 2 < lines.length + 1; i += 3) {
    const name = lines[i]
    const l1 = lines[i + 1]
    const l2 = lines[i + 2]
    if (!name || !l1?.startsWith('1 ') || !l2?.startsWith('2 ')) continue

    const inclination = Number.parseFloat(l2.substring(8, 16))
    const raan = Number.parseFloat(l2.substring(17, 25))
    const ecc = Number.parseFloat(`0.${l2.substring(26, 33).trim()}`)
    const argp = Number.parseFloat(l2.substring(34, 42))
    const ma = Number.parseFloat(l2.substring(43, 51))
    const meanMotion = Number.parseFloat(l2.substring(52, 63)) // rev/day
    if (!Number.isFinite(meanMotion) || meanMotion <= 0) continue

    const nRadPerSec = (meanMotion * 2 * Math.PI) / 86400
    const aKm = Math.cbrt(MU / (nRadPerSec * nRadPerSec))
    const altitudeKm = aKm - EARTH_RADIUS_KM
    if (!Number.isFinite(altitudeKm)) continue

    rows.push([
      Number(altitudeToAtlasRadius(altitudeKm).toFixed(4)), // 轨道半径（图谱单位）
      Number(ecc.toFixed(4)),
      Number(((inclination * Math.PI) / 180).toFixed(4)),
      Number(((raan * Math.PI) / 180).toFixed(4)),
      Number(((argp * Math.PI) / 180).toFixed(4)),
      Number(((ma * Math.PI) / 180).toFixed(4)),
      Number(((meanMotion * 2 * Math.PI) / 86400).toFixed(6)), // 角速度 rad/s
      Number.isFinite(altitudeKm) && altitudeKm > 30000 ? 2 : altitudeKm > 2000 ? 1 : 0, // 0 LEO / 1 MEO / 2 GEO
    ])
  }
  return rows
}

async function main() {
  console.log('· 下载 CelesTrak 在轨目录')
  const response = await fetch(SOURCE)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const text = await response.text()
  console.log(`  ${(text.length / 1024 / 1024).toFixed(2)} MB`)

  const rows = parseTle(text)
  console.log(`· 解析出 ${rows.length} 个在轨对象`)
  if (rows.length < 1000) throw new Error('解析结果过少，检查 TLE 格式是否变化')

  const orbitCounts = rows.reduce((acc, row) => {
    const key = row[7] === 0 ? 'LEO' : row[7] === 1 ? 'MEO' : 'GEO'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  console.log('  ', orbitCounts)

  const payload = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    sourceName: 'CelesTrak — Active Satellites (GP data)',
    scaleNote: 'ORBITAL ALTITUDES EXAGGERATED (LOG SCALE) FOR LEGIBILITY',
    count: rows.length,
    orbitCounts,
    /** 每 8 个数字描述一颗卫星 */
    stride: 8,
    data: rows.flat(),
  }

  const target = path.join(root, 'public', 'data', 'earth-catalog.json')
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload))
  console.log(`· 写入 ${path.relative(root, target)}  ${(JSON.stringify(payload).length / 1024).toFixed(0)} KB`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
