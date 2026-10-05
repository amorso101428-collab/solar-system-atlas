import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {flowDisplay,advectFlow} from '../src/lib/flowDisplay';
import {oceanRouteSegments} from '../src/lib/oceanRouteSegments';
import {cloudLevel} from '../src/components/earth/adaptiveClouds';
const global=flowDisplay(1440,900,'HIGH',true),near=flowDisplay(1440,900,'HIGH',true);
assert.equal(global.width,near.width);assert.ok(global.count<=650);assert.ok(global.spacing>=42);
assert.ok(flowDisplay(390,844,'LOW',false).count<global.count);
// A 20 px/s streak travels the same number of pixels at two very different ranges.
for(const metresPerPixel of [50,20000]){
 const [lon,lat]=advectFlow(0,0,12,0,1,metresPerPixel);
 assert.ok(Math.abs(lon*111319.49/metresPerPixel-20)<1e-7);assert.equal(lat,0);
}
assert.ok(advectFlow(179.99,0,10,0,1,10000)[0]<0);
assert.deepEqual(advectFlow(28,-8,0,0,10,100),[28,-8]);
assert.equal(cloudLevel(19e6,'HIGH'),0);assert.equal(cloudLevel(4e6,'HIGH'),1);assert.equal(cloudLevel(8e5,'HIGH'),2);assert.equal(cloudLevel(8e5,'LOW'),1);
const manifest=JSON.parse(readFileSync('public/earth/cloud-tiles/manifest.json','utf8'));
assert.deepEqual(manifest.nativeSize,[8192,4096]);assert.deepEqual(manifest.levels,[2048,4096,8192]);
for(let level=0;level<3;level++)for(let y=0;y<2*2**level;y++)for(let x=0;x<4*2**level;x++)assert.ok(existsSync(`public/earth/cloud-tiles/${level}/${x}-${y}.webp`));
const clipped=oceanRouteSegments([[-10,0],[20,0]],lon=>lon<0||lon>10);assert.equal(clipped.length,2);assert.ok(clipped.flat().every(([lon])=>lon<0||lon>10));
assert.equal(oceanRouteSegments([[25,0],[45,0]],lon=>lon>29&&lon<30,8).length,0,'Isolated lake-sized path fragments must not receive ocean-current names');
const wrapped=oceanRouteSegments([[178,-15],[-178,-15]],()=>true);assert.equal(wrapped.length,1);assert.ok(wrapped[0].some(([lon])=>lon>179)&&wrapped[0].some(([lon])=>lon<-179));
console.log('Pixel-consistent flow geometry, bounded density, advection/dateline and native cloud pyramid coverage passed.');
