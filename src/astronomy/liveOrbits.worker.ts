// Import the installed JS core without satellite.js 7's optional pthread/WASM exports.
import { json2satrec } from '../../node_modules/satellite.js/dist/io.js'
import { propagate, gstime } from '../../node_modules/satellite.js/dist/propagation.js'
import { eciToEcf } from '../../node_modules/satellite.js/dist/transforms.js'
import type { OMMJsonObject, SatRec } from 'satellite.js'
let records: Array<{ sat:SatRec; epoch:number; id:number }> = []
let trackIndices:number[]=[]
let timer:ReturnType<typeof setTimeout> | undefined
let paused=false, lastTracks=0
const interval=2000
function position(sat:SatRec,ms:number,gmst=gstime(new Date(ms))):number[] | null {
  const result=propagate(sat,new Date(ms))
  if(!result?.position || sat.error)return null
  const p=eciToEcf(result.position,gmst)
  const radius=Math.hypot(p.x,p.y,p.z)
  if(!Number.isFinite(radius) || radius<6371)return null
  // ECEF X/Y/Z -> registered SphereGeometry X/Y/Z, in Earth radii.
  return [p.x/6378.137,p.z/6378.137,-p.y/6378.137]
}
function tick(){
  if(paused)return
  const time=Date.now(), nextTime=time+interval
  const start=new Float32Array(records.length*3), end=new Float32Array(records.length*3)
  const valid=new Float32Array(records.length)
  const gmst0=gstime(new Date(time)),gmst1=gstime(new Date(nextTime))
  for(let i=0;i<records.length;i++){
    const record=records[i]!
    // Do not extrapolate stale elements indefinitely or display decayed objects.
    if(Math.abs(time-record.epoch)>7*86400000)continue
    const a=position(record.sat,time,gmst0), b=position(record.sat,nextTime,gmst1)
    if(!a || !b)continue
    start.set(a,i*3);end.set(b,i*3);valid[i]=1
  }
  const tracks:Array<{index:number;points:Float32Array}>=[]
  if(time-lastTracks>20000){
    lastTracks=time
    for(const index of trackIndices){
      if(!valid[index])continue
      const sat=records[index]!.sat,period=2*Math.PI/sat.no*60000
      const points=new Float32Array(97*3)
      let ok=true
      for(let j=0;j<=96;j++){const p=position(sat,time+period*j/96,gmst0);if(!p){ok=false;break}points.set(p,j*3)}
      if(ok)tracks.push({index,points})
    }
  }
  self.postMessage({type:'positions',time,start,end,valid,tracks}, {transfer:[start.buffer,end.buffer,valid.buffer,...tracks.map(t=>t.points.buffer)]})
  timer=setTimeout(tick,interval)
}
self.onmessage=(event:MessageEvent)=>{
  if(event.data.type==='init'){
    clearTimeout(timer);records=event.data.records.map((r:OMMJsonObject)=>({sat:json2satrec(r),epoch:Date.parse(r.EPOCH.endsWith('Z')?r.EPOCH:r.EPOCH+'Z'),id:Number(r.NORAD_CAT_ID)}))
    trackIndices=event.data.trackIndices;lastTracks=0;tick()
  }else if(event.data.type==='pause'){
    paused=event.data.value;clearTimeout(timer);if(!paused && records.length)tick()
  }
}
