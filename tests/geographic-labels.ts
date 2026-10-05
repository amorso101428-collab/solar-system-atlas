import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {GLOBAL_LABELS,labelText,hasEnglishLabel,labelZoom,eligibleLabel,labelOpacity,labelFontSize,labelBudget,inGeographicBounds,boxesOverlap,type PlaceLabel} from '../src/lib/geographicLabels';
import {decodePlaceTile,slippyTile,tileLonLat,loadPlaceTile} from '../src/lib/localPlaceTiles';
import {CLOUD_DISPLAY_HEIGHT,cloudVisibility} from '../src/lib/cloudHeight';
assert.equal(GLOBAL_LABELS.filter(p=>p.kind==='continent').length,7);
assert.equal(new Set(GLOBAL_LABELS.filter(p=>p.kind==='ocean').map(p=>p.oceanId)).size,5);
const africa=GLOBAL_LABELS.find(p=>p.cn==='非洲')!;
assert.equal(labelText(africa,'en'),'Africa');assert.equal(eligibleLabel(africa,3),true);assert.equal(eligibleLabel(africa,7),false);
assert.ok(hasEnglishLabel('Mont Blanc · Chamonix'));assert.ok(hasEnglishLabel('São Paulo'));
assert.ok(!hasEnglishLabel('浦明路'));assert.ok(!hasEnglishLabel('빈강대도'));assert.ok(!hasEnglishLabel('Road 上海'));
const countries:PlaceLabel[]=JSON.parse(readFileSync('public/geo/country-labels.json','utf8'));
const cities:PlaceLabel[]=JSON.parse(readFileSync('public/geo/city-labels.json','utf8'));
for(const data of [countries,cities]){assert.equal(new Set(data.map(p=>p.id)).size,data.length);assert.ok(data.every(p=>p.cn&&p.en&&Number.isFinite(p.lon+p.lat)&&Math.abs(p.lat)<=90));}
assert.ok(countries.length>200&&cities.length>7000);
const china=countries.find(p=>p.id==='country:CHN')!;assert.equal(china.cn,'中华人民共和国');assert.ok(eligibleLabel(china,5));assert.ok(!eligibleLabel(china,9));
const taiwan=countries.find(p=>p.id==='country:TWN')!;assert.equal(taiwan.cn,'台湾');assert.equal(labelText({...taiwan,cn:'中华民国'},'zh-CN'),'台湾');assert.equal(labelText(taiwan,'en'),'Taiwan');
const shanghai=cities.find(p=>p.en==='Shanghai')!;assert.equal(shanghai.cn,'上海');assert.ok(eligibleLabel(shanghai,10));
// Major cities precede small settlements; zoom changes the candidate set and
// opacity, while screen typography and crowding remain bounded.
const smallCity:PlaceLabel={...shanghai,rank:10,minZoom:5};
assert.ok(!eligibleLabel(smallCity,8.9));assert.ok(eligibleLabel(smallCity,9.4));
assert.equal(labelOpacity(smallCity,9),0);assert.ok(labelOpacity(smallCity,9.175)>.49&&labelOpacity(smallCity,9.175)<.51);
assert.equal(labelOpacity(smallCity,10),1);assert.ok(labelOpacity(africa,4.3)<.3);
assert.ok(eligibleLabel({...shanghai,rank:1,minZoom:5},18));
assert.ok(!eligibleLabel({...smallCity,kind:'poi',minZoom:10},13.9));
assert.equal(labelFontSize,12);assert.ok(labelBudget(390,844)<=22);assert.ok(labelBudget(1440,900)<=48);
assert.ok(labelZoom(1e4,720,0)>labelZoom(1e7,720,0));assert.ok(Math.abs(labelZoom(0,720,0,156543.03392/16*100)-4)<1e-6);
const crossing={west:170,east:-170,north:50,south:-50};assert.ok(inGeographicBounds(179,0,crossing));assert.ok(inGeographicBounds(-179,0,crossing));assert.ok(!inGeographicBounds(0,0,crossing));assert.ok(!inGeographicBounds(179,60,crossing));
assert.ok(boxesOverlap({left:0,top:0,right:20,bottom:20},{left:25,top:0,right:40,bottom:20}));assert.ok(!boxesOverlap({left:0,top:0,right:20,bottom:20},{left:30,top:0,right:40,bottom:20}));
assert.deepEqual(slippyTile(180,0,4),slippyTile(-180,0,4));assert.equal(slippyTile(0,90,4).y,0);assert.equal(slippyTile(0,-90,4).y,15);
assert.deepEqual(tileLonLat(8,8,4),{lon:0,lat:0});
// Actual provider data verifies multilingual point, line and polygon decoding.
const raw=readFileSync('tests/fixtures/shanghai-z14.mvt.gz'),bytes=gunzipSync(raw);
const places=decodePlaceTile(bytes,13721,6694,14);
assert.ok(places.some(p=>p.cn==='外滩'&&p.en==='The Bund'&&p.kind==='poi'));
assert.ok(places.findIndex(p=>p.en==='The Bund')<places.findIndex(p=>p.en==='Dongtai Road'));
assert.ok(places.some(p=>p.cn==='东泰路'&&p.en==='Dongtai Road'&&p.kind==='road'));
assert.ok(places.every(p=>p.lon>121&&p.lon<122&&p.lat>31&&p.lat<32));
assert.ok(decodePlaceTile(bytes,13721,6694,10).every(p=>p.kind!=='road'&&p.kind!=='poi'));
const originalFetch=globalThis.fetch;let requests=0;
try{
 globalThis.fetch=async()=>{requests++;return requests===1?Response.json({tiles:['https://example.test/{z}/{x}/{y}.mvt']}):new Response(raw);};
 const a=await loadPlaceTile({x:13721,y:6694,z:14},new AbortController().signal);
 const b=await loadPlaceTile({x:13721,y:6694,z:14},new AbortController().signal);
 assert.deepEqual(a,places);assert.equal(a,b);assert.equal(requests,2);
}finally{globalThis.fetch=originalFetch;}
assert.ok(CLOUD_DISPLAY_HEIGHT>13000&&CLOUD_DISPLAY_HEIGHT<60000);
assert.equal(cloudVisibility(CLOUD_DISPLAY_HEIGHT),0);assert.equal(cloudVisibility(0),0);assert.equal(cloudVisibility(NaN),0);assert.equal(cloudVisibility(2000000),1);assert.equal(cloudVisibility(1175000),.5);assert.equal(cloudVisibility(350000),0);assert.ok(cloudVisibility(800000)<.2);
console.log('Geographic tiers, bilingual names, dateline bounds, local vector decoding/cache and cloud crossing passed.');
