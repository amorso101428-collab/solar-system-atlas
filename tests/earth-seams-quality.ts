import assert from 'node:assert/strict';
import {buildSyntheticField,sampleUV,isWater} from '../src/lib/currentField';
import {distToPath} from '../src/lib/pick';
import {snapQuality} from '../src/lib/quality';
import {imageryDetailAlpha} from '../src/lib/earthDetail';
const field=buildSyntheticField();
// Adjacent cells at the date line must be as smooth as interior neighbors.
// This fails the old nonperiodic gyres and longitude noise.
for(let lat=-65;lat<=65;lat+=5){
 const left=sampleUV(field,179.75,lat),right=sampleUV(field,-179.75,lat);
 assert.ok(Math.hypot(left[0]-right[0],left[1]-right[1])<.015,`Date-line discontinuity at ${lat}`);
 assert.deepEqual(sampleUV(field,180,lat),sampleUV(field,-180,lat));
 assert.deepEqual(sampleUV(field,539.75,lat),left);
}
field.ocean.fill(0);field.ocean[180*field.width]=1;
assert.equal(isWater(field,180,.25),true);assert.equal(isWater(field,-180,.25),true);assert.equal(isWater(field,540,.25),true);
assert.ok(distToPath(-179,0,[[178,0],[-178,0]])<1e-9);
assert.equal(distToPath(0,0,[[178,0],[-178,0]]),178);
assert.equal(imageryDetailAlpha(7394200),0);assert.equal(imageryDetailAlpha(4500000),.5);assert.equal(imageryDetailAlpha(2855200),1);assert.equal(imageryDetailAlpha(600000),1);
for(const [input,index,quality] of [[-.5,0,'LOW'],[.49,0,'LOW'],[.5,1,'MEDIUM'],[1.49,1,'MEDIUM'],[1.5,2,'HIGH'],[4,2,'HIGH'],[NaN,1,'MEDIUM']] as const){assert.deepEqual(snapQuality(input),{index,quality});}
console.log('Date-line flow continuity, cyclic water mask/current picking, coherent orbital imagery and quality snapping passed.');
