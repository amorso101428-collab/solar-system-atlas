import { useSyncExternalStore } from 'react'
import { Vector3, Quaternion } from 'three'
import { PLANET_BY_ID } from '../data/planets'
import { axisQuaternion, spinAngle, daysSinceJ2000 } from './orientation'
import { useAtlasStore } from '../state/atlasStore'
import type { OMMJsonObject } from 'satellite.js'
import { OBJECTS } from '../data/objects'

export type OrbitRecord = OMMJsonObject & { OBJECT_NAME:string }
export type OrbitFrame = { time:number;start:Float32Array;end:Float32Array;valid:Float32Array;tracks:Array<{index:number;points:Float32Array}> }
type Status={ state:'loading'|'ready'|'offline'|'unavailable';count:number;valid:number;updated:string;source:string;error:string }
let status:Status={state:'loading',count:0,valid:0,updated:'',source:'CelesTrak GP / SGP4',error:''}
const listeners=new Set<()=>void>()
function notify(p:Partial<Status>){status={...status,...p};listeners.forEach(fn=>fn())}
export function useOrbitStatus(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>status)}
export function getOrbitStatus(){return status}
export let liveFrame:OrbitFrame|null=null
export let liveRecords:OrbitRecord[]=[]
export const missionOrbitIndex=new Map<string,number>()
export const liveTracks=new Map<number,Float32Array>()
// Explicit identities only: never fuzzy-match "Hubble" to a different satellite.
const catalogIds:Record<string,number>={iss:25544,tiangong:48274,hubble:20580,terra:25994,aqua:27424,aura:28376,swift:28485,fermi:33053,'xmm-newton':25989,tess:43435,cheops:44874,'goes-16':41866,'himawari-9':41836,'suomi-npp':37849,'landsat-8':39084,'sentinel-1a':39634,'sentinel-2a':40697,swot:54754}
const normalize=(name:string)=>name.toUpperCase().replace(/[^A-Z0-9]/g,'')
let worker:Worker|null=null, refreshTimer:ReturnType<typeof setInterval>|undefined, users=0
let controller:AbortController|null=null
function install(records:OrbitRecord[],source:'ready'|'offline',fetchedAt:string){
  if(!worker)return
  liveRecords=records.filter(r=>Number.isFinite(Number(r.NORAD_CAT_ID))&&Number.isFinite(Number(r.MEAN_MOTION))&&Number(r.MEAN_MOTION)>0&&Number(r.ECCENTRICITY)>=0&&Number(r.ECCENTRICITY)<1&&Number.isFinite(Date.parse(r.EPOCH)))
  const byId=new Map(liveRecords.map((r,i)=>[Number(r.NORAD_CAT_ID),i]))
  const byName=new Map<string,number[]>()
  liveRecords.forEach((r,i)=>{const n=normalize(r.OBJECT_NAME);byName.set(n,[...(byName.get(n)??[]),i])})
  missionOrbitIndex.clear();liveTracks.clear();liveFrame=null
  for(const object of OBJECTS){
    if(object.system!=='earth'||object.kind==='constellation'||['DECAYED','IMPACTED','LANDED','LOST'].includes(object.status))continue
    const exact=byName.get(normalize(object.name))
    const index=catalogIds[object.id]?byId.get(catalogIds[object.id]!):exact?.length===1?exact[0]:undefined
    if(index!==undefined)missionOrbitIndex.set(object.id,index)
  }
  notify({state:source,count:liveRecords.length,updated:fetchedAt,error:source==='offline'?'公开服务暂不可用，使用随项目保存的轨道要素；超过 7 天的记录不显示为当前位置。':''})
  worker.postMessage({type:'init',records:liveRecords,trackIndices:[...new Set(missionOrbitIndex.values())]})
}
async function refresh(){
  controller?.abort();const request=new AbortController();controller=request
  const timeout=setTimeout(()=>request.abort(),15000)
  try{
    const response=await fetch('/api/orbits',{signal:request.signal})
    if(!response.ok)throw new Error('upstream')
    const json=await response.json()
    if(!Array.isArray(json)||!json.length)throw new Error('invalid GP payload')
    install(json,'ready',response.headers.get('X-Orbit-Fetched-At')??new Date().toISOString())
  }catch{
    if(!worker)return
    if(liveRecords.length){notify({state:'offline',error:'刷新失败，继续使用已有要素；按各记录历元检查时效。'});return}
    try{const response=await fetch('/data/earth-live.json');if(!response.ok)throw new Error('no cache');const json=await response.json();if(!Array.isArray(json))throw new Error('invalid cache');const meta=await fetch('/data/earth-live-meta.json').then(r=>r.json()).catch(()=>({fetchedAt:''}));install(json,'offline',meta.fetchedAt??'')}
    catch{notify({state:'unavailable',error:'轨道数据暂不可用。当前任务位置仅为档案示意。'})}
  }finally{clearTimeout(timeout)}
}
function visibility(){worker?.postMessage({type:'pause',value:document.hidden})}
export function startLiveOrbits(){
  users++
  if(!worker){
    worker=new Worker(new URL('./liveOrbits.worker.ts',import.meta.url),{type:'module'})
    worker.onmessage=(event:MessageEvent<OrbitFrame&{type:string}>)=>{
      if(event.data.type!=='positions')return
      liveFrame=event.data;for(const track of event.data.tracks)liveTracks.set(track.index,track.points)
      const valid=event.data.valid.reduce((n,v)=>n+v,0)
      if(status.valid!==valid)notify({valid})
    }
    worker.onerror=()=>notify({state:'unavailable',valid:0,error:'轨道计算暂不可用'})
    void refresh();refreshTimer=setInterval(()=>{if(!document.hidden)void refresh()},2*3600000)
    document.addEventListener('visibilitychange',visibility)
  }
  return()=>{if(--users===0){controller?.abort();worker?.terminate();worker=null;clearInterval(refreshTimer);document.removeEventListener('visibilitychange',visibility);liveFrame=null;liveTracks.clear();missionOrbitIndex.clear();liveRecords=[]}}
}
export function missionLivePosition(id:string,out:Vector3,now=Date.now()):boolean{
  const index=missionOrbitIndex.get(id), f=liveFrame
  if(index===undefined||!f||!f.valid[index]||now-f.time>10000)return false
  const k=Math.max(0,Math.min(1,(now-f.time)/2000)),o=index*3
  out.set(f.start[o]!+(f.end[o]!-f.start[o]!)*k,f.start[o+1]!+(f.end[o+1]!-f.start[o+1]!)*k,f.start[o+2]!+(f.end[o+2]!-f.start[o+2]!)*k)
  return true
}

export function isLiveOrbitMode(){const s=useAtlasStore.getState();return !s.playing && s.timelineYear>=new Date().getUTCFullYear()}
export function earthRotationDays(year:number){return isLiveOrbitMode()?(Date.now()-Date.UTC(2000,0,1,12))/86400000:daysSinceJ2000(year)}
const yAxis=new Vector3(0,1,0),spin=new Quaternion()
export function earthFixedFrame(year:number,out=new Quaternion()){
  const orientation=PLANET_BY_ID.get('earth')!.orientation
  return axisQuaternion(orientation,out).multiply(spin.setFromAxisAngle(yAxis,spinAngle(orientation,earthRotationDays(year))))
}
