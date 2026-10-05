import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {flowStep,flowEnvelope,flowBudget} from '../src/lib/streamline';
import {findPlaces} from '../src/lib/placeSearch';
import {domesticMapMode,createBasemap} from '../src/components/earth/basemap';
import {configureAtmosphere} from '../src/components/earth/atmosphere';
const C=new Function(readFileSync('public/vendor/cesium/Cesium.js','utf8')+';return Cesium;')();
const east=()=>[10,0],north=()=>[0,10];
for(const lat of [-70,0,70]){
 const next=flowStep(179.99,lat,10000,east),back=flowStep(...next,-10000,east);
 assert.ok(next[0]<0);assert.ok(Math.abs(back[0]-179.99)<1e-7);assert.equal(next[1],lat);
}
assert.ok(flowStep(0,10,10000,north)[1]>10);
assert.deepEqual(flowStep(30,20,1000,()=>[0,0]),[30,20]);
assert.ok(flowStep(0,88,1e7,north)[1]<=88.5);
const a=flowBudget(1440,900,'HIGH',false),mobile=flowBudget(390,844,'LOW',false);
assert.equal(a.width,mobile.width);assert.ok(a.length>=140&&mobile.count<=380);assert.ok(a.count<=1000);assert.equal(mobile.fps,24);assert.equal(flowBudget(844,390,'HIGH',true).fps,24);
assert.equal(flowEnvelope(0,180),0);assert.equal(flowEnvelope(180,180),0);assert.equal(flowEnvelope(90,180),1);
assert.equal(domesticMapMode({}), 'satellite');assert.equal(domesticMapMode({mapSource:'tianditu'}),'satellite');assert.equal(domesticMapMode({tiandituKey:'test'}),'satellite');assert.equal(domesticMapMode({mapSource:'geoq'}),'geoq');
let options:any;const fake={...C,UrlTemplateImageryProvider:class {constructor(o:any){options=o;}},WebMapTileServiceImageryProvider:class {constructor(o:any){options=o;}}};
createBasemap(fake,{});assert.equal(options.url,'/earth/local-tiles/{z}/{y}/{x}.jpg?v=20261003-1');assert.equal(options.maximumLevel,4);assert.equal(options.tileWidth,675);
createBasemap(fake,{mapSource:'tianditu',tiandituKey:'test'});assert.ok(options.url.startsWith('https://t{s}.tianditu.gov.cn/'));assert.equal(options.tileMatrixLabels[0],'1');assert.equal(options.tileMatrixLabels.length,18);
const manifest=JSON.parse(readFileSync('public/earth/local-tiles/manifest.json','utf8'));assert.deepEqual(manifest.nativeSize,[21600,10800]);
for(let z=0;z<=4;z++)for(let y=0;y<2**z;y++)for(let x=0;x<2*2**z;x++)assert.ok(existsSync(`public/earth/local-tiles/${z}/${y}/${x}.jpg`),'Complete polar/dateline tile coverage');
const names=JSON.parse(readFileSync('public/geo/city-labels.json','utf8'));assert.ok(findPlaces(names,'上海').some(p=>p.en.toLowerCase().includes('shanghai')));assert.ok(findPlaces(names,'Shanghai').some(p=>p.cn.includes('上海')));
let stage:any,removed=false;const viewer={isDestroyed:()=>false,scene:{skyAtmosphere:undefined,globe:{},atmosphere:{},fog:{},postProcessStages:{add:(s:any)=>stage=s,remove:(s:any)=>{removed=s===stage;}}}};const atmo=configureAtmosphere(C,viewer as any);assert.equal(stage.name,'earth-density-limb');assert.ok(stage.fragmentShader.includes('exp(-abs(height)'));atmo.dispose();assert.ok(removed);
assert.ok(viewer.scene.skyAtmosphere);assert.equal((viewer.scene.skyAtmosphere as any).show,true);assert.equal((viewer.scene.globe as any).showGroundAtmosphere,true);
assert.ok((viewer.scene.globe as any).atmosphereRayleighScaleHeight>(viewer.scene.globe as any).atmosphereMieScaleHeight);
console.log('Geographic RK2 streamlines, stable pixel budgets, soft trace ends, offline pyramid/search, explicit domestic service config and scattering atmosphere passed.');
