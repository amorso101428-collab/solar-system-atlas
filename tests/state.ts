import assert from 'node:assert/strict';
import { pickOcean, sphereHitToLonLat } from '../src/lib/pick';
import { lonLatToVec3 } from '../src/lib/geo';
import { translate } from '../src/i18n';
import { useAtlas } from '../src/state/store';
import { DEFAULT_LAYERS } from '../src/lib/layerRegistry';
import { parseCurrentField } from '../src/lib/currentFieldBinary';
assert.deepEqual(Object.keys(DEFAULT_LAYERS).filter(k=>DEFAULT_LAYERS[k]).sort(),['atmosphere','clouds','labels','land','ocean','stars']);
const s=useAtlas.getState;
s().toggleLayer('graticule');const original={...s().layers};
s().setPanel('learn');s().setLessonStep(2);s().toggleLayer('wind');
s().setLocale('en');assert.equal(s().lessonStep,2);assert.equal(s().panel,'learn');
s().setPanel('dive');s().select({kind:'dive',id:'palau-blue-corner'});s().select({kind:'species',id:'blue-whale'});s().closeDossier();assert.equal(s().panel,'dive');
s().setPanel(null);assert.deepEqual(s().layers,original);
s().setLibrary({libraryQuery:'黑潮',libraryTab:'current'});s().setPanel('library');s().select({kind:'current',id:'kuroshio'});const selection=s().selection;const layers=s().layers;s().setLocale('zh-CN');assert.equal(s().selection,selection);assert.equal(s().layers,layers);s().closeDossier();assert.equal(s().panel,'library');assert.equal(s().libraryQuery,'黑潮');
// One-cell fixture checks the published binary path retains a warmth channel.
const buf=new ArrayBuffer(44),d=new DataView(buf);new Uint8Array(buf).set(new TextEncoder().encode('OACF'));
d.setUint16(4,1,true);d.setUint16(6,1,true);d.setUint16(8,1,true);d.setFloat32(18,1,true);d.setFloat32(22,1,true);d.setFloat64(26,1234,true);d.setInt16(39,3000,true);d.setInt16(41,4000,true);d.setUint8(43,1);
const field=parseCurrentField(buf);assert.equal(field.speed[0],.5);assert.equal(field.warm.length,1);assert.equal(field.ocean[0],1);
assert.throws(()=>parseCurrentField(buf.slice(0,42)));d.setUint16(4,2,true);assert.throws(()=>parseCurrentField(buf));
console.log('State transitions, layer restoration, locale retention, and binary field checks passed.');

assert.equal(pickOcean(160,0)?.id,'pacific');
for(const [lon,lat] of [[28,-8],[-170,44],[170,-28]]){const [x,y,z]=lonLatToVec3(lon,lat,1);const [lo,la]=sphereHitToLonLat({x,y,z},1);assert.ok(Math.abs(lo-lon)<1e-6&&Math.abs(la-lat)<1e-6);}
assert.equal(translate('NOV–MAY','zh-CN'),'11–5月');assert.equal(translate('West Australian','zh-CN'),'西澳大利亚洋流');
s().setPanel('library');s().select({kind:'species',id:'blue-whale'});s().select({kind:'species',id:'sperm-whale'});s().backDossier();assert.equal(s().selection.id,'blue-whale');assert.equal(s().panel,'dossier');s().backDossier();assert.equal(s().panel,'library');assert.equal(s().dossierHistory.length,0);
s().requestCamera('in');assert.equal(s().cameraAction?.kind,'in');s().setLocale('en');assert.equal(s().cameraAction?.kind,'in');
import {profileAt} from '../src/components/WaterColumn';
assert.equal(profileAt(0).t,22);assert.equal(profileAt(1000).s,34.7);assert.equal(profileAt(6000).t,1.5);assert.equal(profileAt(20000).d,11000);assert.equal(profileAt(-10).d,0);assert.ok(Math.abs(profileAt(5000).t-1.65)<1e-6);

// Globe-only legacy routes and cloud preferences survive switching analyses.
s().setPanel(null);s().setAnalysis('natural');assert.equal(s().layers.clouds,true);
s().setAnalysis('currents');assert.equal(s().layers.clouds,false);assert.equal(s().layers.currents,true);assert.equal(s().time.playing,true);s().setPlaying(false);assert.equal(s().time.playing,false);
s().setAnalysis('wind');assert.equal(s().layers.currents,false);assert.equal(s().layers.wind,true);assert.equal(s().layers.clouds,false);
s().setAnalysis('rain');assert.equal(s().layers.wind,false);assert.equal(s().layers.rain,true);
s().setAnalysis('natural');s().toggleLayer('clouds');s().setAnalysis('wind');s().setAnalysis('natural');assert.equal(s().layers.clouds,false);
s().toggleLayer('clouds');s().setView('MAP');assert.equal(s().view,'GLOBE');assert.equal(s().layers.currents,true);assert.equal(s().layers.clouds,false);
s().setView('DEPTH');assert.equal(s().view,'GLOBE');assert.equal(s().panel,'profile');
import {MIN_CAMERA_DISTANCE,MAX_CAMERA_DISTANCE,clampCameraDistance} from '../src/lib/cameraLimits';
assert.ok(MIN_CAMERA_DISTANCE>1);assert.equal(clampCameraDistance(.5),MIN_CAMERA_DISTANCE);assert.equal(clampCameraDistance(30),MAX_CAMERA_DISTANCE);assert.equal(clampCameraDistance(NaN),4);assert.equal(clampCameraDistance(2),2);
import {parseWeatherGrid,sampleWeather} from '../src/lib/weatherGrid';
const meta={width:4,height:2,lon0:0,lat0:-10,dLon:90,dLat:20,validTime:'2026-10-01T21:00:00Z',source:'fixture',displayResolution:'90°',binary:'fixture'};
const values=new Float32Array([0,0,0,10,0,1,20,0,2,30,0,3,0,10,4,10,10,5,20,10,6,30,10,7]);const weather=parseWeatherGrid(meta,values.buffer);
assert.deepEqual(sampleWeather(weather,90,10),[10,10,5]);assert.deepEqual(sampleWeather(weather,-90,-10),[30,0,3]);assert.deepEqual(sampleWeather(weather,45,0),[5,5,2.5]);assert.deepEqual(sampleWeather(weather,360,-10),[0,0,0]);assert.deepEqual(sampleWeather(weather,180,100),[20,10,6]);assert.throws(()=>parseWeatherGrid(meta,values.buffer.slice(0,12)));const invalid=values.slice();invalid[0]=NaN;assert.throws(()=>parseWeatherGrid(meta,invalid.buffer));
console.log('Globe routes, cloud restoration, camera limits and weather-grid sampling passed.');

// A scalar analysis and a flow mode cannot silently mask another active toggle.
s().setAnalysis("natural");s().toggleLayer("currents");s().toggleLayer("wind");assert.equal(s().layers.currents,false);assert.equal(s().layers.wind,true);assert.equal(s().time.playing,false);s().toggleLayer("warmcold");assert.equal(s().layers.wind,false);assert.equal(s().layers.warmcold,true);s().toggleLayer("currents");assert.equal(s().layers.warmcold,true);assert.equal(s().layers.currents,true);

// Forecast coverage never alters or coexists with the natural cloud shell.
s().setAnalysis('natural');s().toggleLayer('cloudcover');assert.equal(s().layers.cloudcover,true);assert.equal(s().layers.clouds,false);s().toggleLayer('wind');assert.equal(s().layers.cloudcover,false);s().toggleLayer('cloudcover');assert.equal(s().layers.wind,false);s().toggleLayer('currents');assert.equal(s().layers.cloudcover,false);s().setAnalysis('natural');assert.equal(s().layers.clouds,true);assert.equal(s().layers.cloudcover,false);
