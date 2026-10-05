import assert from 'node:assert/strict';
import {useWeather} from '../src/lib/weather';
import {WIND_SYSTEMS,windLabels} from '../src/data/winds';
import {labelText} from '../src/lib/geographicLabels';
const originalFetch=globalThis.fetch,original=useWeather.getState();
const meta={width:2,height:2,lon0:-180,lat0:-90,dLon:180,dLat:180,validTime:'2026-10-03T09:00:00Z',downloadedAt:'2026-10-03T10:00:00Z',binary:'/weather/test.bin',cloudBinary:'/weather/missing-cloud.bin',source:'Test saved forecast',displayResolution:'180°'};
const values=new Float32Array(12).fill(5);
try{
 useWeather.setState({grid:null,state:'idle',refreshing:false});let release!:(v:Response)=>void,announce!:()=>void;
 const waiting=new Promise<void>(r=>announce=r),live=new Promise<Response>(r=>release=r);let binaryLoads=0;
 globalThis.fetch=(async(input)=>{
  const url=String(input);
  if(url==='/weather/gfs-surface.json')return Response.json(meta);
  if(url==='/weather/test.bin'){binaryLoads++;return new Response(values.buffer);}
  if(url==='/api/environment/weather.json'){announce();return live;}
  if(url==='/weather/missing-cloud.bin')throw Error('Optional cloud outage');
  throw Error('Unexpected request '+url);
 }) as typeof fetch;
 const loading=useWeather.getState().load();await waiting;
 assert.equal(useWeather.getState().state,'ready');assert.ok(useWeather.getState().grid?.values.length===12,'Saved wind renders before the refresh request resolves');assert.equal(useWeather.getState().refreshing,true);
 release(Response.json(meta));await loading;
 assert.equal(useWeather.getState().state,'ready');assert.equal(useWeather.getState().refreshing,false);assert.equal(binaryLoads,1,'Matching forecast reuses the saved vector buffer');assert.equal(useWeather.getState().grid?.clouds,undefined,'Cloud outage does not invalidate wind');
 assert.equal(WIND_SYSTEMS.filter(w=>w.family==='belt').length,6);assert.equal(WIND_SYSTEMS.filter(w=>w.family==='monsoon').length,3);
 for(const w of WIND_SYSTEMS){assert.ok(w.name.en&&w.name['zh-CN']&&w.character.en&&w.character['zh-CN']);assert.ok(w.source.url.startsWith('https://'));if(w.family==='monsoon')assert.equal(w.seasons?.length,2);}
 const labels=windLabels(179,40);assert.equal(labels.length,9);assert.ok(labels.every(p=>p.kind==='wind'&&p.subtitle?.cn&&p.subtitle.en&&Math.abs(p.lat)<=85));
 assert.equal(labels.find(p=>p.id==='wind:north-westerlies')?.lon,179);assert.equal(labels.find(p=>p.id==='wind:north-westerlies')?.lat,40);
 assert.equal(labelText(labels.find(p=>p.id==='wind:south-asian-monsoon')!,'en'),'South Asian monsoon');
 useWeather.setState({grid:null,state:'idle',refreshing:false});
 globalThis.fetch=(async(input)=>{const url=String(input);if(url==='/api/environment/weather.json')return new Response('Static host',{status:404});if(url==='/weather/gfs-surface.json')return Response.json(meta);if(url==='/weather/test.bin')return new Response(values.buffer);if(url==='/weather/missing-cloud.bin')return new Response(new Float32Array(4).fill(.5).buffer);throw Error(url);}) as typeof fetch;
 await useWeather.getState().load();assert.equal(useWeather.getState().grid?.clouds?.length,4,'Static hosting still loads the saved cloud channel after the live API fails');
 console.log('Saved-first forecast startup, cloud-channel outage tolerance, buffer reuse and bilingual wind-system descriptions passed.');
}finally{globalThis.fetch=originalFetch;useWeather.setState(original,true);}
