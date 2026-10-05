import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import worker from '../dist-pages/_worker.js';
const originals=globalThis.caches,cache=new Map(),pending=[];
globalThis.caches={default:{match:async key=>cache.get(key.url)?.clone(),put:async(key,value)=>cache.set(key.url,value)}};
let useRange=true,assetCalls=0;
const env={ASSETS:{fetch:async request=>{
 assetCalls++;const bytes=await readFile('dist-pages'+new URL(request.url).pathname),range=request.headers.get('range');
 if(useRange&&range){const [,start,end]=range.match(/bytes=(\d+)-(\d+)/);return new Response(bytes.subarray(Number(start),Number(end)+1),{status:206});}
 return new Response(bytes);
}}},ctx={waitUntil:p=>pending.push(p)},digest=bytes=>createHash('sha256').update(Buffer.from(bytes)).digest('hex');
try{
 for(const path of ['/earth/local-tiles/0/0/0.jpg','/earth/local-tiles/0/0/1.jpg','/earth/local-tiles/3/7/15.jpg','/earth/local-tiles/4/0/0.jpg','/earth/local-tiles/4/15/31.jpg']){
  const response=await worker.fetch(new Request('https://test.example'+path+'?v=20261003-1'),env,ctx);
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/jpeg');
  assert.equal(digest(await response.arrayBuffer()),digest(await readFile('public'+path)));
 }
 await Promise.all(pending);const before=assetCalls;
 for(const [path,type] of [['/earth/local-tiles/manifest.json','application/json'],['/geo/country-labels.json','application/json'],['/vendor/cesium/Widgets/widgets.css','text/css']]){
  const packed=await worker.fetch(new Request('https://test.example'+path),env,ctx);
  assert.equal(packed.status,200);assert.ok(packed.headers.get('content-type').startsWith(type));
  assert.equal(digest(await packed.arrayBuffer()),digest(await readFile('public'+path)));
  const head=await worker.fetch(new Request('https://test.example'+path,{method:'HEAD'}),env,ctx);assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
 }
 await Promise.all(pending);const beforeCached=assetCalls;
 const cached=await worker.fetch(new Request('https://test.example/earth/local-tiles/0/0/0.jpg'),env,ctx);assert.equal(cached.status,200);assert.equal(assetCalls,beforeCached);
 useRange=false;cache.clear();
 const response=await worker.fetch(new Request('https://test.example/earth/local-tiles/4/15/31.jpg'),env,ctx);
 assert.equal(digest(await response.arrayBuffer()),digest(await readFile('public/earth/local-tiles/4/15/31.jpg')));
 assert.equal((await worker.fetch(new Request('https://test.example/earth/local-tiles/5/0/0.jpg'),env,ctx)).status,404);
 assert.equal((await worker.fetch(new Request('https://test.example/earth/local-tiles/0/0/0.jpg',{method:'POST'}),env,ctx)).status,405);
 console.log('Packed tile service passed: original JPEG hashes, low/high zoom and polar edges, Range/full-response fallback, cache and invalid paths.');
}finally{globalThis.caches=originals;}
