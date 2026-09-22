import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { PERF_MAX_DPR } from '../utils/perf'
import { createGpuTimer, gpuStats } from '../utils/perfSampler'
import { useQualitySettings } from '../performance/useQuality'

/**
 * 后处理（方案书 §11）：HDR 渲染 → Bloom → 电影级色调映射。
 *
 * 太阳的"亮"来自线性空间里高于 1 的亮度，而不是把颜色直接画成橙色；
 * Bloom 只抓取超过阈值的那部分，所以画面不会整体过曝。
 */
export function PostFX() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)
  // PerfGovernor 改 dpr 时，这里必须跟着重建尺寸，否则画面会被拉伸
  const dpr = useThree((state) => state.viewport.dpr)
  /**
   * V1.1 §12 / §15：bloom 是阶递降级里的第 2 / 4 / 9 步。
   * 桌面档位（ULTRA）下 strength ×1、分辨率 ×0.5、后处理开启 ——
   * 与 V1 的画面逐字一致。
   */
  const quality = useQualitySettings()
  const bloomRef = useRef<UnrealBloomPass | null>(null)
  // v9.4：真实 GPU 耗时（EXT_disjoint_timer_query_webgl2）
  const timer = useMemo(
    () => createGpuTimer(gl.getContext() as WebGL2RenderingContext),
    [gl]
  )

  const composer = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      /**
       * v9.3：不再用 MSAA。
       *
       * 核显上"半浮点 + 多重采样"目标每帧要付一笔昂贵的带宽税（4× 时实测
       * 1080p 只有 31 帧）。改成单采样后，多出来的预算交给 PerfGovernor 的
       * 渲染比例——同样帧率下它能停在更高的分辨率，画面反而更清楚；
       * 而低于 1 的渲染比例本身就带一层轻微柔化，轨道线的锯齿并不明显。
       */
      samples: 0,
    })
    const instance = new EffectComposer(gl, target)
    instance.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(1, 1),
      0.3, // strength：够亮，但不炸白
      0.62, // radius
      1.04 // threshold：只让太阳的米粒峰 / 谱斑（>1.04）参与。行星、轨道、卫星一律不发光——
      //           这是"到处都是亮点"的根治办法：bloom 只属于太阳与明确的太阳活动。
    )
    bloomRef.current = bloom
    instance.addPass(bloom)
    instance.addPass(new OutputPass())
    /**
     * v9 §23：让 `renderer.info` 累计整帧的所有 pass。
     * 默认每条 render() 都会把统计清零，后处理链跑完后只剩 OutputPass 的 1 次调用；
     * 交给 HUD 显示就是"永远 DRAW 1"。这里关掉自动清零，在每帧开头手动重置。
     */
    gl.info.autoReset = false
    return instance
  }, [camera, gl, scene])

  useEffect(() => {
    const ratio = Math.min(gl.getPixelRatio(), PERF_MAX_DPR)
    composer.setPixelRatio(ratio)
    composer.setSize(size.width, size.height)
    /**
     * v9.3：Bloom 在**半分辨率**上做模糊。
     *
     * UnrealBloomPass 内部是 5 级降采样 + 升采样，成本几乎全在最上面两级，
     * 也就是说像素量直接决定它吃掉多少 GPU 时间。它是模糊效果，半个分辨率
     * 肉眼几乎看不出差别，成本却降到大约 1/4——核显上这是最划算的一刀。
     */
    if (bloomRef.current) {
      bloomRef.current.strength = 0.3 * quality.bloomStrength
      bloomRef.current.setSize(
        Math.max(1, Math.round(size.width * ratio * quality.bloomResolution)),
        Math.max(1, Math.round(size.height * ratio * quality.bloomResolution))
      )
    }
    /**
     * v9.4：后处理渲染目标的显存估算（半浮点 RGBA = 8 字节/像素）
     * 两张全分辨率读写缓冲 + Bloom 降采样链（约 1/3 像素量）。
     */
    const pixels = size.width * ratio * size.height * ratio
    gpuStats.renderTargetBytes = Math.round(pixels * 8 * 2 + pixels * 8 * 0.33)
  }, [composer, gl, size.height, size.width, dpr, quality])

  // priority 1：接管渲染，R3F 不再自己绘制场景
  useFrame(() => {
    gl.info.reset()
    timer.begin()
    /**
     * §12 第 9 步：后处理整体关掉之后直接渲染主场景。
     * 这不是"降级到糊"，而是先走完前面 8 步之后的最后手段。
     */
    if (quality.postFx) composer.render()
    else gl.render(scene, camera)
    timer.end()
  }, 1)

  return null
}
