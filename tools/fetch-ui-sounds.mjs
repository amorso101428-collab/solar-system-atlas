/**
 * 抓取 UI 音效（v7.1 §9–§12）。
 *
 * 来源：https://github.com/romainsimon/uisfx —— TypeScript 代码 MIT，
 * 音频与 sound-pack art 标注为 CC0。
 *
 * **这一版换掉了声音人格**。上一版取的是 `scifi`（"clean holographic ping /
 * digital shimmer"），听感偏 8-bit 提示音，和"电影级天文仪器"的定位不符。
 * v7.1 明确要求：优先 `mechanical`（继电器 / 开关 / 硬件），
 * 重要转场用 `cinematic`（低频冲击 + polished tail），**严禁 `arcade`**。
 *
 * 用法：
 *   node tools/fetch-ui-sounds.mjs            # 缺哪个补哪个
 *   node tools/fetch-ui-sounds.mjs --force    # 全部重下
 *
 * 产物：
 *   public/audio/mechanical/<cue>.mp3
 *   public/audio/cinematic/<cue>.mp3
 *   public/audio/ATTRIBUTIONS.md
 *
 * 换声音时**只改这个脚本里的 PACKS 表**，UI 代码一行都不用动：
 * AudioManager 里"事件 → cue"的映射是稳定的语义层。
 */
import { mkdir, writeFile, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const force = process.argv.includes('--force')

const REPO = 'romainsimon/uisfx'
const BRANCH = 'main'
const userAgent = 'HumanArtifactsAtlas/7.1 (ui sfx fetch for a non-commercial atlas)'

/**
 * 每个声音人格要哪些 cue。
 *
 * mechanical —— 所有离散交互：悬停、按下、开关、选中、时间轴刻度。
 *                它的关键词是 relay / switch / hardware，不带乐音音高，
 *                所以不会读成"提示音"。
 * cinematic  —— 只给"有空间、有尾巴"的大动作：聚焦、返回、进入图谱、目录展开。
 */
const PACKS = {
  /**
   * v7.2 的主声音人格：minimal / studio / dreamy。
   * README 的定义 —— minimal: dry, precise, almost invisible；
   * studio: tactile editing precision with warm restraint；
   * dreamy: airy blooms and slow sparkle。
   * 三者的共同点是"过程感"而不是"提示音感"，对应未来复古主义的极简线条 UI。
   */
  minimal: [
    'hover',
    'press',
    'select',
    'open',
    'close',
    'focus',
    'back',
    'expand',
    'seek',
    'snap',
    'typing',
    'toggle-on',
    'toggle-off',
    'drag-start',
    'lock',
    'progress-step',
    'notification',
    'start',
    'deselect',
    'swipe',
  ],
  studio: [
    'open',
    'close',
    'back',
    'focus',
    'press',
    'snap',
    'release',
    'expand',
    'lock',
    'complete',
    'select',
  ],
  dreamy: [
    'focus',
    'start',
    'open',
    'expand',
    'notification',
    'back',
    'lock',
    'complete',
  ],
  mechanical: [
    'hover',
    'press',
    'open',
    'close',
    'focus',
    'back',
    'select',
    'deselect',
    'toggle-on',
    'toggle-off',
    'seek',
    'snap',
    'scanning',
    'typing',
    'notification',
    'start',
    'expand',
    'drag-start',
    'swipe',
    'lock',
    'complete',
    'release',
    'drop',
    'forward',
    'progress-step',
  ],
  cinematic: [
    'focus',
    'back',
    'open',
    'close',
    'expand',
    'loading',
    'start',
    'complete',
    'lock',
    'forward',
    'notification',
    'swipe',
    'release',
    'long-press',
    'scanning',
  ],
}

async function exists(path) {
  try {
    const info = await stat(path)
    return info.size > 1024
  } catch {
    return false
  }
}

async function download(url, target) {
  const response = await fetch(url, { headers: { 'User-Agent': userAgent } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.byteLength < 1024) throw new Error(`too small (${buffer.byteLength} bytes)`)
  await writeFile(target, buffer)
  return buffer.byteLength
}

const lines = [
  '# Audio attributions',
  '',
  '## UI sound effects',
  '',
  `- Source: [${REPO}](https://github.com/${REPO})`,
  '- License: audio and sound-pack art are released as **CC0**; the TypeScript code is MIT.',
  '- Packs used: `mechanical` (discrete interactions) and `cinematic` (focus / transitions).',
  '  `arcade` and `scifi` are deliberately **not** used — their tonal blips read as 8-bit',
  '  game feedback rather than a scientific instrument (v7.1 §9–§12).',
  '',
  '| file | source |',
  '| --- | --- |',
]

let downloaded = 0
let skipped = 0
let failed = 0
for (const [pack, cues] of Object.entries(PACKS)) {
  const outDir = join(root, 'public', 'audio', pack)
  await mkdir(outDir, { recursive: true })
  for (const cue of cues) {
    const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/packages/uisfx/sounds/${pack}/${cue}.mp3`
    const target = join(outDir, `${cue}.mp3`)
    if (!force && (await exists(target))) {
      skipped++
      lines.push(`| ${pack}/${cue}.mp3 | ${url} |`)
      continue
    }
    try {
      const size = await download(url, target)
      downloaded++
      console.log(`OK   ${pack}/${cue}.mp3  ${(size / 1024).toFixed(1)} KB`)
      lines.push(`| ${pack}/${cue}.mp3 | ${url} |`)
    } catch (error) {
      failed++
      console.log(`--   ${pack}/${cue}.mp3  ${error.message}`)
    }
  }
}

lines.push(
  '',
  '## Removed material',
  '',
  '`public/audio/scifi/` was deleted in v7.1: the tonal holographic pings were the',
  'main source of the "8-bit toy" impression. Run `node tools/fetch-ui-sounds.mjs`',
  'to restore the current packs; nothing in the app references the old folder.',
  '',
  '## Background music',
  '',
  'No track ships with the repository. The player is a UI shell only:',
  'drop a file into `public/audio/music/`, add it to `src/audio/musicTracks.ts`',
  'and record its author / license here before enabling it.'
)

await writeFile(join(root, 'public', 'audio', 'ATTRIBUTIONS.md'), `${lines.join('\n')}\n`, 'utf8')
console.log(`\ndownloaded ${downloaded}, skipped ${skipped}, failed ${failed} -> public/audio/`)
