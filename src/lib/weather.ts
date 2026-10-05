import {parseWeatherGrid,type WeatherGrid,sampleWeather} from "./weatherGrid";
import { create } from "zustand";
export interface WeatherPoint {lon:number;lat:number;time:string;wind:number|null;direction:number|null;rain:number|null;current?:number|null;currentDirection?:number|null;marineTime?:string;}
let inflight:Promise<void>|null=null;
export const useWeather=create<{grid:WeatherGrid|null;points:WeatherPoint[];state:"idle"|"loading"|"ready"|"error";refreshing:boolean;online:boolean;lastChecked:number;point:{lon:number;lat:number};inspect:(lon:number,lat:number)=>void;load:()=>Promise<void>}>((set,get)=>({
 grid:null,points:[],state:"idle",refreshing:false,online:false,lastChecked:0,point:{lon:65,lat:-12},inspect:(lon,lat)=>set({point:{lon:((lon+180)%360+360)%360-180,lat:Math.max(-90,Math.min(90,lat))}}),
 load:()=>{
  if(inflight)return inflight;
  const read=async(url:string,includeClouds=true)=>{
   const m=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!m.ok||!m.headers.get('content-type')?.includes('application/json'))throw Error('Forecast metadata unavailable');
   const meta=await m.json(),saved=get().grid;let grid:WeatherGrid;
   if(saved&&saved.downloadedAt===meta.downloadedAt)grid={...saved,...meta};
   else{const r=await fetch(meta.binary,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Forecast grid unavailable');grid=parseWeatherGrid(meta,await r.arrayBuffer());}
   // A missing optional cloud channel cannot prevent valid wind from opening.
   if(includeClouds&&meta.cloudBinary&&!grid.clouds)try{
    const r=await fetch(meta.cloudBinary,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Cloud field unavailable');const raw=await r.arrayBuffer();if(raw.byteLength!==grid.width*grid.height*4)throw Error('Invalid cloud grid');const clouds=new Float32Array(raw);if(clouds.some(v=>!Number.isFinite(v)||v<0||v>1))throw Error('Invalid cloud values');grid.clouds=clouds;
   }catch{/* Wind and precipitation remain usable without cloud coverage. */}
   return grid;
  };
  inflight=(async()=>{
   set({state:get().grid?'ready':'loading',refreshing:true});
   // Render the bundled forecast before any refresh-service/network wait.
   if(!get().grid)try{const grid=await read('/weather/gfs-surface.json',false);set({grid,state:'ready',online:false});}catch{}
   try{const grid=await read('/api/environment/weather.json');if(get().grid&&Date.parse(grid.validTime)<Date.parse(get().grid!.validTime))throw Error('Older forecast rejected');set({grid,points:[],state:'ready',online:!grid.refreshFailed,lastChecked:Date.now()});}
   catch{set({state:get().grid?'ready':'error',online:false,lastChecked:Date.now()});}
   finally{
    // A static Pages host has no live GFS endpoint. Load its optional saved
    // cloud channel after wind is already visible, without depending on that API.
    const current=get().grid;
    if(current&&!current.clouds)try{const saved=await read('/weather/gfs-surface.json');if(saved.validTime===current.validTime&&saved.clouds)set({grid:{...current,clouds:saved.clouds,cloudTime:saved.cloudTime}});}catch{}
    set({refreshing:false});inflight=null;
   }
  })();return inflight;
 }

}));

export async function readPoint(lon:number,lat:number,signal:AbortSignal):Promise<WeatherPoint>{
 const q=new URLSearchParams({forecast_days:"1",longitude:lon.toFixed(4),latitude:lat.toFixed(4),current:"wind_speed_10m,wind_direction_10m,precipitation",wind_speed_unit:"ms",timezone:"GMT"});
 const r=await fetch(`https://api.open-meteo.com/v1/forecast?${q}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!r.ok)throw Error(String(r.status));const d=await r.json();
 const p:WeatherPoint={lon,lat,time:d.current.time,wind:d.current.wind_speed_10m,direction:d.current.wind_direction_10m,rain:d.current.precipitation};
 // Marine forecasts may be unavailable at inland cells; absence is never filled with synthetic values.
 try{const q=new URLSearchParams({longitude:lon.toFixed(4),latitude:lat.toFixed(4),current:"ocean_current_velocity,ocean_current_direction",velocity_unit:"ms",cell_selection:"nearest",timezone:"GMT"});const r=await fetch(`https://marine-api.open-meteo.com/v1/marine?${q}`,{signal:AbortSignal.any([signal,AbortSignal.timeout(7000)])});if(r.ok){const m=await r.json();p.current=m.current?.ocean_current_velocity;p.currentDirection=m.current?.ocean_current_direction;p.marineTime=m.current?.time;}}catch{}
 return p;
}
