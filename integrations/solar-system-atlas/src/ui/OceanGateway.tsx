import { useEffect, useState } from 'react'
import { useAtlasStore } from '../state/atlasStore'
import {audio} from '../audio/audioManager'
import {carryMusicChoice} from '../audio/musicVisit'
import { navigateOcean } from '../utils/oceanEntry'
import { useUIMotion } from '../state/uiMotion'
export let oceanArrival={lon:28,lat:-8}
function preserveVisit(){
 try{window.dispatchEvent(new Event('atlas-ocean-coordinates'))}catch{}
 const state=useAtlasStore.getState()
 try{sessionStorage.setItem('atlas.solarReturn',JSON.stringify({year:state.timelineYear,view:state.view,position:state.positionMode,language:state.language,ui:new URLSearchParams(location.search).get('ui'),motion:useUIMotion.getState().mode}));localStorage.setItem('atlas.locale',state.language==='zh'?'zh-CN':'en')}catch{}
 try{carryMusicChoice(audio.isMusicEnabled())}catch{}
}
/** A visible Earth entry is sufficient intent; no hidden focus guard on its click. */
export function goToEarth(language: 'zh' | 'en'){
 navigateOcean(language,oceanArrival,preserveVisit,url=>window.location.assign(url))
}
/** Keep the Earth-only guard for the scene's planet double-click. */
export function enterOcean(){
 const state=useAtlasStore.getState()
 if(state.focusId!=='earth'||state.focusKind!=='PLANET')return
 goToEarth(state.language)
}
export function OceanGatewayButton(){const language=useAtlasStore(s=>s.language);return <button type="button" className="ocean-gateway" onClick={()=>goToEarth(language)}><span>{language==='zh'?'探索这颗星球的海洋':'EXPLORE THIS PLANET’S OCEANS'}</span><strong>{language==='zh'?'探索地球':'EXPLORE EARTH'} <i aria-hidden>↗</i></strong><small>{language==='zh'?'地球 → 洋流 → 深海生命':'EARTH → CURRENTS → LIFE IN THE DEEP'}</small></button>}
export function OceanGateway(){const [returning,setReturning]=useState(()=>new URLSearchParams(location.search).get("return")==="ocean");
 useEffect(()=>{if(!returning)return;const timer=setTimeout(()=>setReturning(false),1800);return()=>clearTimeout(timer)},[returning]);
 const language=useAtlasStore(s=>s.language)
 return returning?<div className="solar-ocean-arrival" role="status"><span>{language==='zh'?'地球系统':'EARTH SYSTEM'}</span></div>:null
}
