import type * as Cesium from 'cesium';
import type {Engine} from '../../lib/earthEngine';
import type {WeatherGrid} from '../../lib/weatherGrid';
import {sampleRainSmooth,rainRGBA} from '../../lib/precipitation';
/** Generate only the visible imagery tiles at the globe's chosen LOD. Scalar
 * interpolation precedes color mapping, avoiding giant interpolated RGBA cells.
 * Two workers cooperatively yield; completed canvases go directly to WebGL. */
export function createPrecipitationProvider(C:Engine,grid:WeatherGrid,quality:string){
 const size=quality==='LOW'?256:512,scheme=new C.GeographicTilingScheme(),controller=new AbortController();
 const cache=new Map<string,HTMLCanvasElement>(),pending=new Map<string,Promise<HTMLCanvasElement>>();
 const queue:{run:()=>Promise<HTMLCanvasElement>;resolve:(canvas:HTMLCanvasElement)=>void;reject:(reason:unknown)=>void}[]=[];
 let active=0;
 const draw=async(x:number,y:number,level:number)=>{
  const bounds=scheme.tileXYToRectangle(x,y,level),west=C.Math.toDegrees(bounds.west),north=C.Math.toDegrees(bounds.north),dx=C.Math.toDegrees(bounds.east-bounds.west)/size,dy=C.Math.toDegrees(bounds.north-bounds.south)/size;
  const canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
  const ctx=canvas.getContext('2d')!,pixels=ctx.createImageData(size,size);let deadline=performance.now()+3;
  for(let row=0;row<size;row++){
   if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
   if(performance.now()>deadline){await new Promise(resolve=>setTimeout(resolve,0));deadline=performance.now()+3;}
   const lat=north-(row+.5)*dy;
   for(let col=0;col<size;col++)rainRGBA(sampleRainSmooth(grid,west+(col+.5)*dx,lat),pixels.data,(row*size+col)*4);
  }
  ctx.putImageData(pixels,0,0);return canvas;
 };
 const pump=()=>{
  if(controller.signal.aborted)return;
  while(active<2&&queue.length){const job=queue.shift()!;active++;job.run().then(job.resolve,job.reject).finally(()=>{active--;pump();});}
 };
 const provider={
  tileWidth:size,tileHeight:size,minimumLevel:0,maximumLevel:quality==='LOW'?3:quality==='HIGH'?5:4,
  tilingScheme:scheme,rectangle:scheme.rectangle,hasAlphaChannel:true,errorEvent:new C.Event(),credit:new C.Credit('NOAA / NCEP GFS · precipitation mm/h · native 0.25°'),
  tileDiscardPolicy:undefined,proxy:undefined,getTileCredits:()=>[],pickFeatures:()=>undefined,
  requestImage:(x:number,y:number,level:number)=>{
   if(controller.signal.aborted)return undefined;
   const key=`${level}/${y}/${x}`,saved=cache.get(key);
   if(saved){cache.delete(key);cache.set(key,saved);return Promise.resolve(saved);}
   const existing=pending.get(key);if(existing)return existing;
   if(pending.size>=48)return undefined;
   const promise=new Promise<HTMLCanvasElement>((resolve,reject)=>{queue.push({run:()=>draw(x,y,level),resolve,reject});});pending.set(key,promise);
   promise.then(canvas=>{pending.delete(key);if(controller.signal.aborted)return;cache.set(key,canvas);if(cache.size>32)cache.delete(cache.keys().next().value!);},()=>pending.delete(key));
   pump();return promise;
  }
 } as unknown as Cesium.ImageryProvider;
 return {provider,dispose:()=>{controller.abort();for(const job of queue.splice(0))job.reject(new DOMException('Cancelled','AbortError'));cache.clear();}};
}
export function installPrecipitation(C:Engine,viewer:Cesium.Viewer,grid:WeatherGrid,quality:string){
 const {provider,dispose}=createPrecipitationProvider(C,grid,quality),layer=viewer.imageryLayers.addImageryProvider(provider);
 layer.magnificationFilter=C.TextureMagnificationFilter.LINEAR;layer.minificationFilter=C.TextureMinificationFilter.LINEAR;
 viewer.scene.requestRender();return()=>{dispose();if(!viewer.isDestroyed())viewer.imageryLayers.remove(layer,true);};
}
