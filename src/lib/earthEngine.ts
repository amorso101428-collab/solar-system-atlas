import type * as Cesium from 'cesium';
import {create} from 'zustand';
export type Engine=typeof Cesium;
declare global {interface Window {Cesium?:Engine;CESIUM_BASE_URL?:string;}}
let loading:Promise<Engine>|null=null;
export function loadEarthEngine(){
 if(window.Cesium)return Promise.resolve(window.Cesium);
 if(loading)return loading;
 window.CESIUM_BASE_URL='/vendor/cesium/';
 loading=new Promise<Engine>((resolve,reject)=>{
  if(!document.querySelector('link[data-cesium]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/vendor/cesium/Widgets/widgets.css';css.dataset.cesium='true';document.head.append(css);}
  const script=document.createElement('script');script.src='/vendor/cesium/Cesium.js';script.async=true;
  script.onload=()=>window.Cesium?resolve(window.Cesium):reject(Error('Earth engine unavailable'));
  script.onerror=()=>{script.remove();loading=null;reject(Error('Earth engine unavailable'));};document.head.append(script);
 });return loading;
}
export const MIN_EYE_HEIGHT=30;
export const MAX_EYE_HEIGHT=50000000;
export function minimumCameraHeight(ground:number){return Math.max(0,Number.isFinite(ground)?ground:0)+MIN_EYE_HEIGHT;}
export function zoomRange(range:number,kind:'in'|'out'){const d=Number.isFinite(range)?range:19000000;return Math.max(MIN_EYE_HEIGHT*2,Math.min(MAX_EYE_HEIGHT,kind==='in'?d/1.75:d*1.75));}
export interface EarthConfig {googleMapsApiKey?:string;mapSource?:'local'|'tianditu'|'geoq'|'satellite';tiandituKey?:string;externalPlaceDetails?:boolean;externalTerrain?:boolean;}
export type EarthCommand={kind:'in'|'out'|'home'|'north'|'tilt'|'fly'|'retry';lon?:number;lat?:number;range?:number;pitch?:number;key:number;};
export const useEarthView=create<{ready:boolean;detail:'off'|'loading'|'ready'|'error';mapSource:'local'|'tianditu'|'geoq'|'satellite';externalPlaceDetails:boolean;externalTerrain:boolean;pending:number;placeNames:'idle'|'loading'|'ready'|'fallback';lon:number;lat:number;altitude:number;ground:number;heading:number;pitch:number;scaleMeters:number;imagery:'loading'|'ready'|'error';terrain:'loading'|'ready'|'error';google:'off'|'loading'|'ready'|'error';command:EarthCommand|null;request:(command:Omit<EarthCommand,'key'>)=>void}>((set)=>({ready:false,detail:'off',mapSource:'satellite',externalPlaceDetails:false,externalTerrain:false,pending:0,placeNames:'idle',lon:28,lat:-8,altitude:19000000,ground:0,heading:0,pitch:-90,scaleMeters:1000000,imagery:'loading',terrain:'loading',google:'off',command:null,request:command=>set({command:{...command,key:performance.now()}})}));
export function parseCoordinates(query:string):{lon:number;lat:number}|null{const parts=query.trim().split(/[,，\s]+/);if(parts.length!==2||parts.some(s=>!/^[-+]?\d+(\.\d+)?$/.test(s)))return null;const [first,second]=parts.map(Number);const [lat,lon]=Math.abs(first)>90?[second,first]:[first,second];return Math.abs(lon)<=180&&Math.abs(lat)<=90?{lon,lat}:null;}
export function placeRange(south:number,north:number,west:number,east:number){if(![south,north,west,east].every(Number.isFinite))return 16000;const latitude=(south+north)/2,longitudeSpan=east>=west?east-west:east-west+360;const extent=Math.max(Math.abs(north-south)*111319,longitudeSpan*111319*Math.max(.1,Math.cos(latitude*Math.PI/180)));return Math.max(4000,Math.min(19000000,extent*1.5));}
