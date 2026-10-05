import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {environmentFeed} from '../scripts/environment-feed.mjs';
const raw=await readFile('public/weather/gfs-surface-source.nc'),meta=JSON.parse(await readFile('public/weather/gfs-surface.json','utf8')),originalFetch=globalThis.fetch;
async function run(mode:'success'|'network'|'old'){
 const root=await mkdtemp(join(tmpdir(),'ocean-weather-test-'));let count=0;
 try{await mkdir(join(root,'weather'));await writeFile(join(root,'weather/gfs-surface.json'),JSON.stringify({...meta,downloadedAt:'2000-01-01T00:00:00Z',validTime:mode==='old'?'2030-01-01T00:00:00Z':'2000-01-01T00:00:00Z'}));for(const file of ['gfs-surface.bin','gfs-clouds.bin'])await writeFile(join(root,'weather',file),await readFile(join('public/weather',file)));
 globalThis.fetch=(async()=>{count++;if(mode==='network')throw Error('Test upstream outage');return {ok:true,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)};}) as typeof fetch;
 const serve=environmentFeed(root);async function query(path='/api/environment/weather.json'){let status=0,body:unknown;const handled=await serve({url:path},{writeHead:(code:number)=>{status=code;},end:(data:unknown)=>{body=data;}});assert.equal(handled,true);return {status,body};}
 let result=await query(),state=JSON.parse(String(result.body));for(let i=0;state.updating&&i<100;i++){await new Promise(r=>setTimeout(r,10));state=JSON.parse(String((await query()).body));}assert.equal(state.updating,false);assert.equal(count,1);
 if(mode==='success'){assert.equal(state.validTime,meta.validTime);assert.equal(state.width,1440);assert.equal(state.refreshFailed,false);assert.notEqual(state.downloadedAt,'2000-01-01T00:00:00Z');const binary=await query(state.cloudBinary);assert.equal(binary.status,200);assert.equal((binary.body as Buffer).byteLength,1440*721*4);assert.equal((await query('/api/environment/weather.bin?version=expired')).status,404);}
 else{assert.equal(state.refreshFailed,true);assert.equal(state.downloadedAt,'2000-01-01T00:00:00Z');assert.equal(state.validTime,mode==='old'?'2030-01-01T00:00:00Z':'2000-01-01T00:00:00Z');}
 }finally{globalThis.fetch=originalFetch;await rm(root,{recursive:true,force:true});}
}
await run('success');await run('network');await run('old');console.log('Refresh service: publication, cache, binary generation, outage retention and stale forecast rejection passed.');
