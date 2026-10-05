import {useEffect,useState} from 'react';
import {audio} from '../../integrations/solar-system-atlas/src/audio/audioManager';
import {useLanguage} from '../i18n';
import {useAtlas} from '../state/store';
import {musicForContext} from '../lib/musicEasterEggs';
export default function MusicSwitch(){
 const overlay=useAtlas(s=>s.overlay);
 const {t}=useLanguage(),[on,setOn]=useState(()=>audio.isMusicEnabled()),[track,setTrack]=useState(()=>audio.getContextTrack()),[error,setError]=useState(false);
 useEffect(()=>{const cleanup=audio.autoStart();const change=()=>setOn(audio.isMusicEnabled());window.addEventListener('atlas-music-change',change);return()=>{cleanup();window.removeEventListener('atlas-music-change',change);}},[]);
 useEffect(()=>{const change=()=>{setTrack(audio.getContextTrack());setError(audio.hasMusicError());};const sync=()=>{const s=useAtlas.getState();void audio.setContextTrack(musicForContext(s.panel,s.selection,s.denmarkMusic),true);};window.addEventListener('atlas-music-track-change',change);sync();const stop=useAtlas.subscribe((s,p)=>{if(s.panel!==p.panel||s.selection!==p.selection||s.denmarkMusic!==p.denmarkMusic)sync();});return()=>{stop();window.removeEventListener('atlas-music-track-change',change);void audio.setContextTrack(null);};},[]);
 return <div className="earth-music-group"><button className="earth-music" aria-pressed={on} title={track?`${track.title} · ${track.artist}`:undefined} onClick={()=>void audio.setMusicEnabled(!on)}>{t(`音乐 · ${on?'开':'关'}`,`Music · ${on?'On':'Off'}`)}</button>
 {track&&<details className="earth-music-now" open={overlay==="music"} onToggle={e=>{const st=useAtlas.getState();if(e.currentTarget.open&&st.overlay!=="music")st.setOverlay("music");else if(!e.currentTarget.open&&st.overlay==="music")st.setOverlay(null);}}><summary role="button" aria-label={t('查看彩蛋音乐','View Easter egg music')}>♫</summary><div className="earth-music-card" aria-live="polite"><small>{t('音乐彩蛋','Easter egg music')}{track.preview?t(' · 官方试听',' · Official preview'):''}</small><strong>{track.title}</strong><span>{track.artist}</span>{error&&<p role="status">{t('音源暂不可用，可重试或到官方平台收听。','Audio unavailable. Retry or listen on the official service.')}</p>}<button aria-pressed={on} onClick={()=>void audio.setMusicEnabled(!on)}>{on?t('关闭音乐','Turn music off'):t('开启音乐','Turn music on')}</button>{error&&on&&<button onClick={()=>void audio.playMusic()}>{t('重试播放','Retry playback')}</button>}<a href={track.bandcamp} target="_blank" rel="noreferrer">{t('官方曲目页','Official song page')} ↗</a></div></details>}
 </div>;
}
