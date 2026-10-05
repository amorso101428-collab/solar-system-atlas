import assert from 'node:assert/strict';
import {decodeElevation,mercatorY,sampleElevation,MERCATOR_LAT} from '../src/lib/terrainGrid';
assert.equal(decodeElevation(128,0,0),0);assert.equal(decodeElevation(127,255,0),-1);assert.equal(decodeElevation(128,100,128),100.5);
assert.equal(mercatorY(0),.5);assert.ok(Math.abs(mercatorY(MERCATOR_LAT))<1e-12);assert.ok(Math.abs(mercatorY(-MERCATOR_LAT)-1)<1e-12);assert.equal(mercatorY(90),mercatorY(MERCATOR_LAT));assert.equal(mercatorY(-90),mercatorY(-MERCATOR_LAT));
for(let lat=0;lat<=90;lat+=.25)assert.ok(Math.abs(mercatorY(lat)+mercatorY(-lat)-1)<1e-12);
const rgba=new Uint8ClampedArray([128,0,0,255,128,100,0,255,128,200,0,255,129,44,0,255]);assert.equal(sampleElevation(rgba,2,.5,.5),150);assert.equal(sampleElevation(rgba,2,-10,-10),0);assert.equal(sampleElevation(rgba,2,9,9),300);
console.log('DEM units, bilinear interpolation, bounds and polar projection passed.');
