import assert from 'node:assert/strict'
import fs from 'node:fs'
import {Worker} from 'node:worker_threads'
import {pathToFileURL} from 'node:url'
import path from 'node:path'
import {json2satrec,propagate,eciToEcf,gstime} from 'satellite.js'
const records=JSON.parse(fs.readFileSync('public/data/earth-live.json','utf8'))
const ids=[25544,48274,20580]
const indices=ids.map(id=>records.findIndex(r=>r.NORAD_CAT_ID===id))
assert(indices.every(i=>i>=0))
const expired={...records[indices[0]],EPOCH:'2000-01-01T00:00:00',NORAD_CAT_ID:999999999}
const samples=[...records,expired]
const filename=fs.readdirSync('dist/assets').find(f=>/^liveOrbits.worker-.*\.js$/.test(f))
assert(filename,'Run npm run build first')
const url=pathToFileURL(path.resolve('dist/assets',filename)).href
const worker=new Worker(`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(data,options)=>parentPort.postMessage(data,options?.transfer)};import(${JSON.stringify(url)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({type:'ready'})})`,{eval:true})
const timeout=setTimeout(()=>{worker.terminate();throw new Error('Orbit worker timeout')},15000)
try {
  const frame=await new Promise((resolve,reject)=>{worker.on('error',reject);worker.on('message',m=>{if(m.type==='ready')worker.postMessage({type:'init',records:samples,trackIndices:indices});else if(m.type==='positions')resolve(m)})})
  assert.equal(frame.valid[samples.length-1],0,'Expired elements must be suppressed')
  for(const index of indices){
    assert.equal(frame.valid[index],1)
    const sat=json2satrec(records[index]),date=new Date(frame.time),result=propagate(sat,date)
    const p=eciToEcf(result.position,gstime(date)),expected=[p.x,p.z,-p.y]
    const actual=Array.from(frame.start.slice(index*3,index*3+3),v=>v*6378.137)
    const error=Math.hypot(...actual.map((v,i)=>v-expected[i]))
    assert(error<.02,`Coordinate mismatch ${error} km`)
    const movement=Math.hypot(...actual.map((v,i)=>v-frame.end[index*3+i]*6378.137))
    assert(movement>10&&movement<20,`Unexpected 2-second motion ${movement} km`)
    const track=frame.tracks.find(t=>t.index===index);assert(track&&track.points.length===291)
    assert(Math.hypot(...actual.map((v,i)=>v-track.points[i]*6378.137))<.02,'Orbit and marker must share position')
    console.log(`PASS NORAD ${records[index].NORAD_CAT_ID}: coordinate error ${(error*1000).toFixed(2)} m; 2s motion ${movement.toFixed(3)} km; orbit aligned`)
  }
  console.log(`PASS ${records.length} records; ${frame.valid.reduce((a,b)=>a+b,0)} current positions; expired record suppressed`)
} finally {clearTimeout(timeout);await worker.terminate()}
