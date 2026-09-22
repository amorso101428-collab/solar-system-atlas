import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { PERF_MAX_DPR, PERF_MIN_SCALE, perfState } from '../utils/perf'

/**
 * 自适应渲染质量（v9.3）。
 *
 * 每 1.5 秒统计一次真实帧率：
 *   · 低于 50 帧 → 渲染比例乘 0.85（最多降到 0.55，GPU 负载随之按面积下降）
 *   · 连续三次高于 58 帧 → 缓慢回调（每次 +6%），避免掉进低画质出不来
 *   · 标签页不可见时不调整，也不累积统计
 *
 * 只改渲染分辨率，不动任何场景内容：几何、贴图、后处理效果都保持原样，
 * 所以视觉上只是"更柔和一点"，不会变成另一套画面。
 */
export function PerfGovernor() {
  const setDpr = useThree((state) => state.setDpr)
  const applied = useRef(0)

  useEffect(() => {
    const base = Math.min(window.devicePixelRatio || 1, PERF_MAX_DPR)
    let raf = 0
    let frames = 0
    let windowStart = performance.now()
    let goodStreak = 0

    const apply = () => {
      const next = Math.round(base * perfState.scale * 100) / 100
      if (Math.abs(next - applied.current) < 0.01) return
      applied.current = next
      setDpr(next)
    }

    apply()

    const tick = (now: number) => {
      frames++
      const elapsed = now - windowStart
      if (elapsed >= 1500) {
        const fps = (frames * 1000) / elapsed
        perfState.fps = Math.round(fps)
        frames = 0
        windowStart = now
        if (!document.hidden) {
          if (fps < 50) {
            goodStreak = 0
            const next = Math.max(PERF_MIN_SCALE, perfState.scale * 0.85)
            if (next < perfState.scale - 0.001) {
              perfState.scale = next
              perfState.degraded = true
              apply()
            }
          } else if (fps > 58) {
            goodStreak++
            if (goodStreak >= 3 && perfState.scale < 1) {
              perfState.scale = Math.min(1, perfState.scale * 1.06)
              apply()
            }
          } else {
            goodStreak = 0
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [setDpr])

  return null
}
