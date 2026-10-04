import { useEffect, useState } from 'react'
import { liveFrame, liveRecords, missionOrbitIndex, useOrbitStatus, isLiveOrbitMode } from '../astronomy/liveOrbits'
import { useAtlasStore } from '../state/atlasStore'
export function OrbitTelemetry({objectId}:{objectId?:string}){
  const status=useOrbitStatus(),zh=useAtlasStore(s=>s.language)==='zh'
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const index=objectId?missionOrbitIndex.get(objectId):undefined
  const record=index===undefined?null:liveRecords[index]
  const current=isLiveOrbitMode()&&!!liveFrame&&now-liveFrame.time<10000&&(index!==undefined?Boolean(liveFrame.valid[index]):status.valid>0)
  const label=current?(zh?'当前 UTC · 轨道推算':'CURRENT UTC · PROPAGATED'):status.state==='loading'?(zh?'正在载入公开轨道数据':'LOADING ORBITS'):(zh?'历史 / 示意位置 · 非实时':'HISTORICAL / SCHEMATIC · NOT LIVE')
  return <div className="orbit-telemetry" data-live={current}>
    <strong>{label}</strong>
    {current?<time>{new Date(now).toISOString().slice(0,19).replace('T',' ')} UTC</time>:null}
    {record?<small>NORAD {record.NORAD_CAT_ID} · {zh?'要素历元':'EPOCH'} {record.EPOCH.replace('T',' ').slice(0,19)} UTC</small>:null}
    {!objectId?<small>{status.valid.toLocaleString()} / {status.count.toLocaleString()} {zh?'条有效当前位置 · 其余记录过期或不可传播':'valid current positions; others stale or unpropagatable'}</small>:null}
    {current?<small>{zh?'公开轨道要素推算，非实时遥测；以真实时间 1× 更新。':'Public orbital elements, not live telemetry; real-time 1×.'}</small>:<small>{zh?'没有有效当前星历的任务保留档案示意，不伪造当前位置。':'Missions without valid current ephemerides retain schematic archive positions.'}</small>}
    {status.error?<small>{zh?status.error:'Live refresh unavailable; cached elements are checked for freshness.'}</small>:null}
  </div>
}
