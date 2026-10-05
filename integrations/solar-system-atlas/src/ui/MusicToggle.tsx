import {useEffect,useState} from 'react'
import {audio} from '../audio/audioManager'
import {useAtlasStore} from '../state/atlasStore'
export function MusicToggle(){
 const language=useAtlasStore(s=>s.language)
 const [enabled,setEnabled]=useState(()=>audio.isMusicEnabled())
 useEffect(()=>{const update=()=>setEnabled(audio.isMusicEnabled());window.addEventListener('atlas-music-change',update);return()=>window.removeEventListener('atlas-music-change',update)},[])
 return <button type="button" className="music-toggle" aria-pressed={enabled} onClick={()=>void audio.setMusicEnabled(!enabled)}>{language==='zh'?`音乐 · ${enabled?'开':'关'}`:`MUSIC · ${enabled?'ON':'OFF'}`}</button>
}
