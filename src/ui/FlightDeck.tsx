import { useEffect } from 'react'
import { useExperience, cameraCommand } from '../state/experience'
import { useAtlasStore } from '../state/atlasStore'
import { audio } from '../audio/audioManager'
export function FlightDeck({ onAction }: { onAction?: () => void }) {
  const experience = useExperience()
  const zh = useAtlasStore(s => s.language) === 'zh'
  const toggle = (key: 'rotate' | 'orbit' | 'immersive' | 'sound' | 'annotations' | 'context') => {
    audio.unlock()
    useExperience.setState(s => ({[key]: !s[key], ...(key==='orbit' ? {observation:null} : {})}))
    audio.emit('toggle.on')
    onAction?.()
  }
  return <div className="view-controls" aria-label={zh ? '镜头控制' : 'Camera controls'}>
    <div className="navmenu__rule" />
    <div className="navmenu__group">{zh ? '镜头控制' : 'CAMERA'}</div>
    <div className="view-controls__zoom">
      <button className="navmenu__item" title={zh ? '拉近 (+)' : 'Zoom in (+)'} onClick={() => { cameraCommand('in'); onAction?.() }}>＋ {zh ? '拉近' : 'In'}</button>
      <button className="navmenu__item" title={zh ? '推远 (-)' : 'Zoom out (-)'} onClick={() => { cameraCommand('out'); onAction?.() }}>− {zh ? '推远' : 'Out'}</button>
      <button className="navmenu__item" title="R" onClick={() => {useExperience.setState({orbit:false}); cameraCommand('reset'); onAction?.()}}>↺ {zh ? '复位' : 'Reset'}</button>
    </div>
    {(['rotate','orbit','annotations','context','sound'] as const).map((key,i)=><label className="navmenu__check" key={key}>
      <input type="checkbox" checked={experience[key]} onChange={()=>toggle(key)} />
      {zh ? ['左键拖动旋转','自动环绕','地理标注','显示周边任务','交互音效'][i] : ['Left-drag rotation','Auto orbit','Geographic labels','Surrounding missions','Interface sound'][i]}
    </label>)}
    <button className="navmenu__item" onClick={() => toggle('immersive')}>{zh ? '沉浸观看' : 'Immersive view'} <em>I</em></button>
  </div>
}

export function ExperienceShortcuts() {
  const experience=useExperience()
  const focus=useAtlasStore(s=>s.focusId)
  const zh=useAtlasStore(s=>s.language)==='zh'
  useEffect(() => { audio.setEnabled(experience.sound) }, [experience.sound])
  useEffect(() => { useExperience.setState({ orbit: false, observation: null }) }, [focus])
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]') || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === '+' || e.key === '=') cameraCommand('in')
      if (e.key === '-') cameraCommand('out')
      if (e.key.toLowerCase() === 'r') cameraCommand('reset')
      if (e.key.toLowerCase() === 'i') useExperience.setState(s => ({immersive: !s.immersive}))
      if (e.key === 'Escape') useExperience.setState({immersive:false, orbit:false})
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])
  return experience.immersive ? <button className="navbtn immersive-exit" onClick={()=>useExperience.setState({immersive:false})}>{zh ? '返回界面' : 'SHOW INTERFACE'} <em>ESC</em></button> : null
}
