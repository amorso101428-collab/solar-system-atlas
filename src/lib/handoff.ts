import {useAtlas, type Locale} from "../state/store";
import {audio} from '../../integrations/solar-system-atlas/src/audio/audioManager';
import {carryMusicChoice} from '../../integrations/solar-system-atlas/src/audio/musicVisit';
export function returnToUniverse(locale:Locale){
 document.documentElement.dataset.oceanReturn="departing";
 setTimeout(()=>{carryMusicChoice(audio.isMusicEnabled());location.assign('/solar/?lang='+(locale==='en'?'en':'zh'))},useAtlas.getState().reducedMotion||matchMedia('(prefers-reduced-motion:reduce)').matches?0:650);
}
export function returnToSolar(locale:Locale){
 const q=new URLSearchParams({view:"atlas",body:"earth",lang:locale==="en"?"en":"zh",boot:"0",return:"ocean"});
 try{const saved=JSON.parse(sessionStorage.getItem("atlas.solarReturn")||"null");if(saved){q.set("year",String(saved.year));if(saved.position==="REAL")q.set("position","real");if(saved.view==="ORBIT3D")q.set("unfold","1");if(saved.ui==="heritage"){q.set("ui","heritage");if(saved.motion==="full"||saved.motion==="reduced")q.set("motion",saved.motion);}}}catch{}
 document.documentElement.dataset.oceanReturn="departing";
 setTimeout(()=>{carryMusicChoice(audio.isMusicEnabled());location.assign("/solar/index.html?"+q)},useAtlas.getState().reducedMotion||matchMedia("(prefers-reduced-motion:reduce)").matches?0:650);
}
