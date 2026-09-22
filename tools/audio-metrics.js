/**
 * 音效客观指标（v7.1 §9–§13 的选型依据）。
 *
 * 这段不是 Node 脚本，而是**送进浏览器里求值的表达式**——因为只有浏览器能解码
 * mp3。配合 tools/ui-probe.ps1 使用：
 *
 *   pwsh -File .\tools\ui-probe.ps1 -Url 'index.html?view=atlas' `
 *     -ExprFile .\tools\audio-metrics.js
 *
 * 输出每个 cue 的：
 *   ms        时长（§13 要求 hover 20–60ms、click 60–120ms、转场 500–900ms）
 *   rms       能量（越小越"退后"）
 *   centroid  频谱重心 Hz —— 越高越"尖锐 / 电子提示音"
 *   flatness  频谱平坦度 0–1 —— 越接近 0 越像乐音（8-bit 方波就是极低的平坦度
 *             配上很高的重心），越接近 1 越像继电器 / 气流那样的噪声
 */
(async () => {
  const files = [
    // 候选（v7.2：未来复古主义 / 极简线条）
    'audio/minimal/hover.mp3',
    'audio/minimal/press.mp3',
    'audio/minimal/select.mp3',
    'audio/minimal/open.mp3',
    'audio/minimal/close.mp3',
    'audio/minimal/focus.mp3',
    'audio/minimal/back.mp3',
    'audio/minimal/expand.mp3',
    'audio/minimal/seek.mp3',
    'audio/minimal/snap.mp3',
    'audio/minimal/typing.mp3',
    'audio/minimal/toggle-on.mp3',
    'audio/minimal/drag-start.mp3',
    'audio/minimal/lock.mp3',
    'audio/minimal/progress-step.mp3',
    'audio/studio/open.mp3',
    'audio/studio/close.mp3',
    'audio/studio/back.mp3',
    'audio/studio/focus.mp3',
    'audio/studio/press.mp3',
    'audio/studio/snap.mp3',
    'audio/studio/release.mp3',
    'audio/studio/expand.mp3',
    'audio/studio/lock.mp3',
    'audio/dreamy/focus.mp3',
    'audio/dreamy/start.mp3',
    'audio/dreamy/open.mp3',
    'audio/dreamy/expand.mp3',
    'audio/dreamy/notification.mp3',
    'audio/dreamy/back.mp3',
    // 对照组：上一版用的（用户嫌 8-bit / 噔噔咚咚）
    'audio/mechanical/press.mp3',
    'audio/cinematic/focus.mp3',
  ]
  const bands = [80, 120, 180, 270, 400, 600, 900, 1350, 2000, 3000, 4500, 6700, 10000]
  const ctx = new (window.AudioContext || window.webkitAudioContext)()
  const rows = []
  for (const file of files) {
    const response = await fetch(file)
    if (!response.ok) {
      rows.push({ file, error: response.status })
      continue
    }
    const buffer = await ctx.decodeAudioData(await response.arrayBuffer())
    const data = buffer.getChannelData(0)
    const sampleRate = buffer.sampleRate
    let energy = 0
    for (let i = 0; i < data.length; i++) energy += data[i] * data[i]
    const rms = Math.sqrt(energy / Math.max(1, data.length))
    // 取前 4096 个采样（或整段）做 Goertzel，得到 13 个频段的幅度
    const n = Math.min(4096, data.length)
    const mags = bands.map((freq) => {
      const w = (2 * Math.PI * freq) / sampleRate
      const c = 2 * Math.cos(w)
      let s1 = 0
      let s2 = 0
      for (let i = 0; i < n; i++) {
        const s0 = data[i] + c * s1 - s2
        s2 = s1
        s1 = s0
      }
      return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - c * s1 * s2)) / n
    })
    const sum = mags.reduce((a, b) => a + b, 0) || 1e-9
    const centroid = mags.reduce((a, m, i) => a + m * bands[i], 0) / sum
    const meanLog = mags.reduce((a, m) => a + Math.log(m + 1e-9), 0) / mags.length
    const flatness = Math.exp(meanLog) / (sum / mags.length)
    rows.push({
      file: file.replace('audio/', ''),
      ms: Math.round(buffer.duration * 1000),
      rms: Number(rms.toFixed(4)),
      centroid: Math.round(centroid),
      flatness: Number(flatness.toFixed(3)),
    })
  }
  return JSON.stringify(rows)
})()
