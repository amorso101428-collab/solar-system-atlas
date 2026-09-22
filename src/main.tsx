import { createRoot } from 'react-dom/client'
import App from './App'
import { useAtlasStore } from './state/atlasStore'
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

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(<App />)

// 自检钩子（仅 ?debug=1）：让 tools/ui-probe.ps1 能直接读/触发 store 状态
if (new URLSearchParams(window.location.search).get('debug') === '1') {
  ;(window as unknown as { __atlasStore?: unknown }).__atlasStore = useAtlasStore
}
