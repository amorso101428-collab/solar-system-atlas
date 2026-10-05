import * as THREE from 'three'
import { glStats } from './glStats'

/**
 * 遥测采样器（v9.4）。
 *
 * HUD 之前把 CPU / 显存 / GPU 耗时一律写成 N/A，理由是"浏览器不暴露"。
 * 严格来说只有**进程级 CPU 占用率**和**真实显存占用**拿不到，下面这三项
 * 是可以真正测出来的，所以改成实测值，而不是继续写 N/A：
 *
 *   CPU        本站帧回调在 1 秒里占掉主线程的比例（每帧实测累加 / 墙钟时间）
 *   GPU 耗时    EXT_disjoint_timer_query_webgl2 的真实 GPU 时间
 *   VRAM≈      遍历场景统计贴图 + 几何 + 后处理渲染目标的字节数（估算，带 ≈）
 *
 * 拿不到的仍然显示 N/A，不编造。
 */

/* ---------------------------------------------------------------- 主线程 */

let frameStart = 0
let jsMs = 0

/** 每帧第一个回调调用（FrameProfiler 里 priority 最小） */
export function markFrameStart(now: number): void {
  frameStart = now
}

/** 每帧最后一个回调调用（FrameProfiler 里 priority 最大） */
export function markFrameEnd(now: number): void {
  if (frameStart > 0) jsMs += Math.max(0, now - frameStart)
}

/** HUD 每秒取一次：返回这一秒里本站 JS 占用的毫秒数，并清零 */
export function drainFrameJs(): number {
  const value = jsMs
  jsMs = 0
  return value
}

/* ---------------------------------------------------------------- GPU 耗时 */

export const gpuStats: {
  supported: boolean
  /** 最近一次测得的 GPU 帧耗时（毫秒） */
  ms: number | null
  /** 后处理渲染目标占用的字节数（由 PostFX 写入） */
  renderTargetBytes: number
} = { supported: false, ms: null, renderTargetBytes: 0 }

interface TimerQueryExt {
  TIME_ELAPSED_EXT: number
  GPU_DISJOINT_EXT: number
  /** WebGL1 的扩展对象上带这两个常量；WebGL2 上用 context 自己的 */
  QUERY_RESULT_AVAILABLE?: number
  QUERY_RESULT?: number
}

/**
 * GPU 计时器。用查询对象轮转，避免每帧都在等结果：
 * 本帧发起查询，下一帧再取上一帧的结果（GPU 是异步的，读太早拿不到）。
 * 一旦检测到 GPU 被打断（GPU_DISJOINT），这一次结果作废。
 */
export function createGpuTimer(gl: WebGL2RenderingContext): {
  begin: () => void
  end: () => void
} {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null
  if (!ext) return { begin: () => {}, end: () => {} }
  gpuStats.supported = true

  /**
   * WebGL2 里 QUERY_RESULT / QUERY_RESULT_AVAILABLE 定义在 context 上；
   * WebGL1 的扩展才把它们挂在扩展对象上。取错的话查询永远读不出结果，
   * HUD 就会一直停在"测量中"。
   */
  const RESULT_AVAILABLE = gl.QUERY_RESULT_AVAILABLE ?? ext.QUERY_RESULT_AVAILABLE
  const RESULT = gl.QUERY_RESULT ?? ext.QUERY_RESULT

  const free: WebGLQuery[] = []
  const make = () => gl.createQuery() as WebGLQuery | null
  for (let i = 0; i < 3; i++) {
    const q = make()
    if (q) free.push(q)
  }

  let active: WebGLQuery | null = null
  let pending: WebGLQuery | null = null
  let waited = 0

  const collect = () => {
    if (!pending) return
    waited++
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT) as boolean
    const available = Boolean(gl.getQueryParameter(pending, RESULT_AVAILABLE))
    // 超过 20 帧还读不到就放弃这一条，避免查询卡死后再也不采样
    if (!available && waited < 20) return
    if (available && !disjoint) {
      const ns = gl.getQueryParameter(pending, RESULT) as number
      if (Number.isFinite(ns)) gpuStats.ms = Math.round((ns / 1e6) * 100) / 100
    }
    free.push(pending)
    pending = null
    waited = 0
  }

  return {
    begin() {
      collect()
      if (active || pending) return
      const q = free.pop()
      if (!q) return
      active = q
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
    },
    end() {
      if (!active) return
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      pending = active
      active = null
    },
  }
}

/* ---------------------------------------------------------------- 显存估算 */

function textureBytes(texture: THREE.Texture): number {
  const image = texture.image as
    | { width?: number; height?: number; data?: ArrayLike<number> }
    | null
    | undefined
  if (image && image.data && typeof image.data.length === 'number') {
    const per = (image.data as unknown as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 1
    return image.data.length * per
  }
  if (!image || !image.width || !image.height) return 0
  // RGBA8 + 约 1/3 的 mipmap 开销
  return Math.round(image.width * image.height * 4 * 1.33)
}

function geometryBytes(geometry: THREE.BufferGeometry): number {
  let bytes = 0
  for (const key of Object.keys(geometry.attributes)) {
    const attr = geometry.attributes[key] as THREE.BufferAttribute | THREE.InterleavedBufferAttribute
    const array = (attr as { array?: ArrayLike<number>; data?: { array?: ArrayLike<number> } }).array
    const data = array ?? (attr as { data?: { array?: ArrayLike<number> } }).data?.array
    if (!data) continue
    const per = (data as unknown as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 4
    bytes += data.length * per
  }
  const index = geometry.index?.array as ArrayLike<number> | undefined
  if (index) {
    const per = (index as unknown as { BYTES_PER_ELEMENT?: number }).BYTES_PER_ELEMENT ?? 4
    bytes += index.length * per
  }
  return bytes
}

/** 估算场景 + 后处理占用的 GPU 字节数（贴图 / 几何 / 渲染目标） */
export function estimateGpuBytes(): number {
  const scene = glStats.scene
  if (!scene) return gpuStats.renderTargetBytes
  const textures = new Set<THREE.Texture>()
  let bytes = 0

  /**
   * 递归找贴图。只扫两层不行：本站大量材质是 ShaderMaterial，贴图藏在
   * material.uniforms.uXxx.value 里（三层），漏掉就会把显存估算成零头。
   */
  const collectTextures = (value: unknown, depth: number) => {
    if (depth > 3 || !value) return
    if (value instanceof THREE.Texture) {
      textures.add(value)
      return
    }
    if (Array.isArray(value)) {
      for (const item of value) collectTextures(item, depth + 1)
      return
    }
    if (typeof value !== 'object') return
    const record = value as Record<string, unknown>
    for (const key of Object.keys(record)) {
      // 这些字段要么很大要么不可能装贴图，跳过省时间
      if (key === 'defines' || key === 'userData' || key === 'extensions') continue
      collectTextures(record[key], depth + 1)
    }
  }

  scene.traverse((object) => {
    const mesh = object as THREE.Mesh & { material?: THREE.Material | THREE.Material[] }
    if (mesh.geometry) bytes += geometryBytes(mesh.geometry)
    const materials = mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : []
    for (const material of materials) collectTextures(material, 0)
  })

  for (const texture of textures) bytes += textureBytes(texture)
  return bytes + gpuStats.renderTargetBytes
}
