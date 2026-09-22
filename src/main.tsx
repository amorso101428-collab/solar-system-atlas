import { createRoot } from 'react-dom/client'
import App from './App'
import { useAtlasStore } from './state/atlasStore'
import { layoutDebugInfo, startResponsiveRuntime } from './responsive/device'
import { adaptiveQuality } from './performance/AdaptiveQualityManager'
import './styles/tokens.css'
import './styles/typography.css'
import './styles/atlas.css'
import './styles/atlas-v2.css'
import './styles/atlas-v3.css'
import './styles/atlas-v4.css'
import './styles/boot.css'
import './styles/holo.css'
import './styles/music.css'
import './styles/quotes.css'
import './styles/telemetry.css'
import './styles/creator.css'
// 移动端适配层（V1）必须最后加载：所有规则都挂在 [data-device] 上，
// 桌面端不会匹配到任何一条。
import './styles/responsive.css'

/**
 * 先测一次设备与布局模式，再挂 React。
 * 属性在首次渲染之前就写到 <html> 上，所以不会先闪一下桌面布局。
 */
startResponsiveRuntime()
/**
 * V1.1 §11 / §41：自适应画质。先读 `?quality=`（low / medium / high / ultra / safe / auto），
 * 没有参数就是 auto —— 「掉帧才降级」。
 */
adaptiveQuality.start()

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(<App />)

// 自检钩子（仅 ?debug=1）：让 tools/ui-probe.ps1 能直接读/触发 store 状态
if (new URLSearchParams(window.location.search).get('debug') === '1') {
  ;(window as unknown as { __atlasStore?: unknown }).__atlasStore = useAtlasStore
  ;(window as unknown as { __atlasLayout?: unknown }).__atlasLayout = layoutDebugInfo
  /**
   * V1.1 §29：调试钩子。
   *   __atlasQuality()  当前档位 + 阶梯步数 + 各项参数
   *   __atlasPerf()     帧率 / 帧时间 / DPR / draw calls / 三角形 / 贴图 / 几何
   * §30：浏览器拿不到的（CPU 占用率、GPU 利用率、真实显存）一律 N/A，不编造。
   */
  ;(window as unknown as { __atlasQuality?: unknown }).__atlasQuality = () =>
    adaptiveQuality.debugInfo()
  ;(window as unknown as { __atlasPerf?: unknown }).__atlasPerf = () => ({
    fps: adaptiveQuality.metrics.fps,
    frameTimeMs: adaptiveQuality.metrics.frameTime,
    p95FrameTimeMs: adaptiveQuality.metrics.p95FrameTime,
    dpr: window.devicePixelRatio,
    quality: adaptiveQuality.debugInfo(),
  })
}
