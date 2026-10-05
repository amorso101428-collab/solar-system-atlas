import { useAtlasStore } from '../state/atlasStore'
import { useUIMotion } from '../state/uiMotion'

export function HeritageMotionControl() {
  const language = useAtlasStore(s => s.language)
  const { mode, cycle } = useUIMotion()
  const label = language === 'zh'
    ? { auto: '动效 · 自动', full: '动效 · 开', reduced: '动效 · 关' }[mode]
    : { auto: 'Motion · Auto', full: 'Motion · On', reduced: 'Motion · Off' }[mode]
  return <button type="button" className="heritage-motion" onClick={cycle}
    title={language === 'zh' ? '自动遵循系统设置；点击依次切换开启、关闭、自动' : 'Auto follows your system; cycle On, Off, Auto'}>{label}</button>
}
