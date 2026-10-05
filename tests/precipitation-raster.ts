import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {sampleWeather,type WeatherGrid} from '../src/lib/weatherGrid';
import {sampleRain,sampleRainSmooth,rainRGBA} from '../src/lib/precipitation';
import {createPrecipitationProvider} from '../src/components/earth/precipitationRaster';
const C=new Function(readFileSync('public/vendor/cesium/Cesium.js','utf8')+';return Cesium;')();
const grid:WeatherGrid={width:4,height:3,lon0:-180,lat0:-90,dLon:90,dLat:90,validTime:'2026-10-03T09:00Z',source:'fixture',displayResolution:'90°',binary:'',values:new Float32Array(36)};
for(let y=0;y<3;y++)for(let x=0;x<4;x++)grid.values[(y*4+x)*3+2]=(y*4+x)*2;
for(const lon of [-180,-179,-1,0,111,179.99,180,540])for(const lat of [-90,-10,0,42,90])assert.ok(Math.abs(sampleRain(grid,lon,lat)-sampleWeather(grid,lon,lat)[2])<1e-6);
assert.equal(sampleRain(grid,180,0),sampleRain(grid,-180,0));assert.equal(sampleRain(grid,NaN,0),0);
const out=new Uint8ClampedArray(4);rainRGBA(0,out,0);assert.equal(out[3],0);rainRGBA(20,out,0);assert.ok(out[0]>230&&out[3]>=230);rainRGBA(.1,out,0);assert.ok(out[2]>out[0]&&out[3]>0);rainRGBA(30,out,0);assert.ok(out[2]>out[1]);
const constant={...grid,values:new Float32Array(36).fill(7)};
for(const lon of [-180,-90,0,90,180])for(const lat of [-90,0,90])assert.ok(Math.abs(sampleRainSmooth(constant,lon,lat)-7)<1e-6);
const impulse={...grid,values:new Float32Array(36)};impulse.values[(1*4+2)*3+2]=10;
assert.ok(Math.abs(sampleRainSmooth(impulse,-.001,0)-sampleRainSmooth(impulse,.001,0))<1e-5,'Continuous rain-cell edge');
assert.ok(sampleRainSmooth(impulse,0,0)>0&&sampleRainSmooth(impulse,0,0)<10,'Positive, bounded reconstruction');
for(let lon=-180;lon<=180;lon+=7)for(let lat=-90;lat<=90;lat+=11){const rate=sampleRainSmooth(grid,lon,lat);assert.ok(rate>=0&&rate<=22);}assert.equal(sampleRainSmooth(grid,-180,17),sampleRainSmooth(grid,180,17));
const original=globalThis.document;let created=0;
globalThis.document={createElement:()=>{created++;const canvas={width:0,height:0,pixels:null as Uint8ClampedArray|null,getContext:()=>({createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:(im:{data:Uint8ClampedArray})=>{canvas.pixels=im.data;}})};return canvas;}} as unknown as Document;
try{
 const {provider,dispose}=createPrecipitationProvider(C,grid,'HIGH');assert.equal(provider.maximumLevel,5);assert.equal(provider.tileWidth,512);assert.equal(provider.hasAlphaChannel,true);
 const [a,b]=await Promise.all([provider.requestImage(1,0,1),provider.requestImage(1,0,1)]);assert.equal(a,b);assert.equal(created,1);assert.equal(await provider.requestImage(1,0,1),a);assert.equal(created,1);
 const pixel=(a as unknown as {pixels:Uint8ClampedArray}).pixels;assert.ok(pixel.some((v,i)=>i%4===3&&v>200));assert.equal(pixel.length,512*512*4);
 const maxJobs=Array.from({length:50},(_,x)=>provider.requestImage(x%32,Math.floor(x/32),4));assert.ok(maxJobs.some(v=>v===undefined),'Bound generation while navigating');
 const settled=Promise.allSettled(maxJobs.filter(Boolean));dispose();await settled;assert.equal(provider.requestImage(0,0,0),undefined);
 const low=createPrecipitationProvider(C,grid,'LOW');assert.equal(low.provider.maximumLevel,3);low.dispose();
}finally{globalThis.document=original;}
console.log('Precipitation: scalar sampling/seams, intensity colors/opacity, native tiled provider, LOD, cache, generation budget and cancellation passed.');
