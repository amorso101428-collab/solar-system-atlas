import { useEffect, useState } from 'react'
import type * as THREE from 'three'
import { glStats } from '../utils/glStats'
import { perfState } from '../utils/perf'
import { drainFrameJs, estimateGpuBytes, gpuStats } from '../utils/perfSampler'

/**
 * 右上角系统详情 HUD（v9 §23 / §37 Phase G）。
 *
 * 诚实原则：浏览器拿不到的数据一律显示 N/A，**不伪造 CPU / 显存占用**。
 *
 *   可用：FPS、帧时间、长任务（longtask API）、JS 堆（performance.memory，
 *         Chromium 系才有）、draw calls、三角形、纹理数、GPU 渲染器字符串、
 *         GPU 时间（EXT_disjoint_timer_query_webgl2）
 *   v9.4 起新增（都是实测，不是编的）：
 *         CPU     —— 本站每帧回调占用主线程的比例（FrameProfiler 实测）
 *         VRAM≈   —— 遍历场景统计贴图/几何/后处理目标的字节数（估算）
 *         GEOM    —— 几何体数量（renderer.info）
 *   仍然拿不到：进程级 CPU 占用率、驱动报告的真实显存 —— 浏览器不暴露
 */
interface Sample {
  fps: number
  frameMs: number
  /** 主线程占用率（0-100，本站 JS 时间 / 墙钟时间）；不支持时为 null */
  cpuPct: number | null
  longTasks: number
  heapMb: number | null
  /** 显存估算（MB），拿不到场景时为 null */
  vramMb: number | null
  /** 真实 GPU 帧耗时（ms），浏览器未开放计时扩展时为 null */
  gpuMs: number | null
  geometries: number
  drawCalls: number
  triangles: number
  textures: number
  gpu: string
  /** 核显 / 独显 / 软件渲染 */
  gpuKind: string
}

const EMPTY: Sample = {
  fps: 0,
  frameMs: 0,
  cpuPct: null,
  longTasks: 0,
  heapMb: null,
  vramMb: null,
  gpuMs: null,
  geometries: 0,
  drawCalls: 0,
  triangles: 0,
  textures: 0,
  gpu: 'N/A',
  gpuKind: '',
}

/**
 * 判定跑在哪一类显卡上（v9.4）。
 *
 * 网页**无法指定**用哪块 GPU —— 双显卡笔记本上由操作系统和浏览器决定。
 * 这里只做一件事：把实际情况如实标出来（核显 / 独显 / 软件渲染），
 * 让作者和访客一眼看到"是不是掉到核显上了"。
 */
function gpuKind(raw: string): '独显' | '核显' | '软件渲染' | '' {
  if (!raw) return ''
  if (/swiftshader|software|basic render|llvmpipe|microsoft basic/i.test(raw)) return '软件渲染'
  if (/nvidia|geforce|rtx|gtx|quadro|radeon\s+rx|radeon\s+pro|arc\s+[ab]\d/i.test(raw)) return '独显'
  if (/intel|uhd|iris|radeon\s+graphics|vega|gma/i.test(raw)) return '核显'
  return ''
}

/** 取 GPU 渲染器字符串（Chrome 会返回 ANGLE 包装后的真实型号） */
function readGpuString(renderer: THREE.WebGLRenderer | null): { name: string; kind: string } {
  if (!renderer) return { name: 'N/A', kind: '' }
  const gl = renderer.getContext()
  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  const raw = ext
    ? (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string)
    : (gl.getParameter(gl.RENDERER) as string)
  if (!raw) return { name: 'N/A', kind: '' }
  // ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11) → 取括号里第一段
  const inside = raw.match(/ANGLE \(([^,)]+)/)
  const text = inside ? inside[1]! : raw
  return {
    name: text.length > 34 ? `${text.slice(0, 33)}…` : text,
    kind: gpuKind(raw),
  }
}

export function SystemTelemetry() {
  const [sample, setSample] = useState<Sample>(EMPTY)

  useEffect(() => {
    let frames = 0
    let windowStart = performance.now()
    let lastFrame = performance.now()
    let frameAccum = 0
    let longTasks = 0
    let raf = 0

    // 长任务：真实的主线程阻塞指标（Chromium 系支持）
    let observer: PerformanceObserver | null = null
    try {
      observer = new PerformanceObserver((list) => {
        longTasks += list.getEntries().length
      })
      observer.observe({ entryTypes: ['longtask'] })
    } catch {
      observer = null
    }

    const tick = (now: number) => {
      frames++
      frameAccum += now - lastFrame
      lastFrame = now
      const elapsed = now - windowStart
      if (elapsed >= 1000) {
        const renderer = glStats.renderer
        const memory = (
          performance as Performance & { memory?: { usedJSHeapSize: number } }
        ).memory
        // 主线程：这一秒里本站帧回调占掉多少
        const jsMs = drainFrameJs()
        const cpuPct = elapsed > 0 ? Math.min(100, Math.round((jsMs / elapsed) * 100)) : null
        const gpuBytes = estimateGpuBytes()
        const gpuInfo = readGpuString(renderer ?? null)
        setSample({
          fps: Math.round((frames * 1000) / elapsed),
          frameMs: Math.round((frameAccum / Math.max(frames, 1)) * 10) / 10,
          cpuPct,
          longTasks,
          heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
          vramMb: gpuBytes > 0 ? Math.round(gpuBytes / 1048576) : null,
          gpuMs: gpuStats.ms,
          geometries: renderer?.info.memory.geometries ?? 0,
          drawCalls: renderer?.info.render.calls ?? 0,
          triangles: renderer?.info.render.triangles ?? 0,
          textures: renderer?.info.memory.textures ?? 0,
          gpu: gpuInfo.name,
          gpuKind: gpuInfo.kind,
        })
        frames = 0
        frameAccum = 0
        longTasks = 0
        windowStart = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
    }
  }, [])

  return (
    <div className="telemetry" aria-label="系统运行状态">
      <div className="telemetry__row">
        <span>
          <b>FPS</b> {sample.fps || '—'}
        </span>
        <span>
          <b>FRAME</b> {sample.frameMs ? `${sample.frameMs}ms` : '—'}
        </span>
        <span>
          <b>CPU</b> {sample.cpuPct === null ? 'N/A' : `${sample.cpuPct}%`}
        </span>
        <span>
          <b>LONG</b> {sample.longTasks}
        </span>
        <span>
          <b>DRAW</b> {sample.drawCalls || '—'}
        </span>
        <span>
          <b>TEX</b> {sample.textures || '—'}
        </span>
      </div>
      <div className="telemetry__row telemetry__row--dim">
        <span>
          <b>GPU</b> {sample.gpu}
          {sample.gpuKind ? `（${sample.gpuKind}）` : ''}
          {sample.gpuMs !== null
            ? ` · ${sample.gpuMs.toFixed(1)}ms`
            : gpuStats.supported
              ? ' · 测量中'
              : ' · 计时未开放'}
        </span>
        <span>
          <b>SCALE</b> {Math.round(perfState.scale * 100)}%
        </span>
        <span>
          <b>MEM</b> {sample.heapMb !== null ? `${sample.heapMb}M` : 'N/A'}
        </span>
        <span>
          <b>VRAM≈</b> {sample.vramMb !== null ? `${sample.vramMb}M` : 'N/A'}
        </span>
        <span>
          <b>GEOM</b> {sample.geometries || '—'}
        </span>
      </div>
    </div>
  )
}
