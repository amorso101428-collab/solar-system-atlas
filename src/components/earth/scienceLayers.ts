import type * as Cesium from 'cesium';
import type {Engine} from '../../lib/earthEngine';
import {isWater,sampleUV,type CurrentField} from '../../lib/currentField';
import {sampleWeather,sampleCloud,type WeatherGrid} from '../../lib/weatherGrid';
import {DIVE_SITES} from '../../data/divesites';
import {UPWELLING} from '../globe/Markers';
import {loadLand,eachRing} from '../../lib/geo';
import {useAtlas} from '../../state/store';
import {oceanRouteSegments} from '../../lib/oceanRouteSegments';
import {CURRENTS} from '../../data/currents';
const windStops=[[0,10,64,107],[5,16,154,161],[12,125,196,71],[22,242,149,31],[40,194,46,122]];
const rainStops=[[0,20,71,232],[1,5,217,237],[5,82,217,51],[10,255,209,15],[20,255,46,20],[30,237,31,204]];
function color(stops:number[][],v:number){let i=0;while(i<stops.length-2&&v>stops[i+1][0])i++;const a=stops[i],b=stops[i+1],f=Math.min(1,Math.max(0,(v-a[0])/(b[0]-a[0])));return [1,2,3].map(k=>Math.round(a[k]+(b[k]-a[k])*f));}
export async function fieldCanvas(field:CurrentField,grid:WeatherGrid|null,layers:Record<string,boolean>,signal:AbortSignal){
 const canvas=document.createElement('canvas');canvas.width=useAtlas.getState().quality==='LOW'?720:1440;canvas.height=canvas.width/2;const ctx=canvas.getContext('2d')!,im=ctx.createImageData(canvas.width,canvas.height);
 let deadline=performance.now()+5;
 for(let y=0;y<canvas.height;y++){if(signal.aborted)throw new DOMException('Cancelled','AbortError');if(performance.now()>deadline){await new Promise(resolve=>setTimeout(resolve,0));deadline=performance.now()+5;}for(let x=0;x<canvas.width;x++){const lon=-180+(x+.5)*360/canvas.width,lat=90-(y+.5)*180/canvas.height,water=isWater(field,lon,lat),k=(y*canvas.width+x)*4;let c:number[]|null=null,a=0;
  if(grid&&(layers.wind||layers.rain||layers.cloudcover)&&lat>=grid.lat0&&lat<=grid.lat0+grid.dLat*(grid.height-1)){const [u,v,r]=sampleWeather(grid,lon,lat);if(layers.cloudcover&&grid.clouds){const cover=sampleCloud(grid,lon,lat)??0;c=color([[0,22,53,100],[.5,54,175,180],[1,237,225,124]],cover);a=160;}else if(layers.rain&&r>.03){c=color(rainStops,r);a=195*Math.min(1,(r-.03)/.3);}else if(layers.wind){c=color(windStops,Math.hypot(u,v));a=145;}}
  else if(water&&(layers.field||layers.warmcold)){const ix=Math.min(field.width-1,Math.max(0,Math.floor((lon-field.lon0)/field.dLon))),iy=Math.min(field.height-1,Math.max(0,Math.floor((lat-field.lat0)/field.dLat))),idx=iy*field.width+ix;if(layers.warmcold){const f=(field.warm[idx]+1)/2;c=[30+190*f,130-45*f,220-150*f];}else{const [u,v]=sampleUV(field,lon,lat);c=color(windStops,Math.hypot(u,v)*25);}a=130;}
  if(c){im.data[k]=c[0];im.data[k+1]=c[1];im.data[k+2]=c[2];im.data[k+3]=a;}
  if((water&&!layers.ocean)||(!water&&!layers.land)){im.data[k]=4;im.data[k+1]=7;im.data[k+2]=12;im.data[k+3]=255;}
 }}ctx.putImageData(im,0,0);return canvas;
}
export function addScienceRaster(C:Engine,viewer:Cesium.Viewer,canvas:HTMLCanvasElement){const p=new C.SingleTileImageryProvider({url:canvas.toDataURL(),tileWidth:canvas.width,tileHeight:canvas.height,rectangle:C.Rectangle.MAX_VALUE});const layer=viewer.imageryLayers.addImageryProvider(p);layer.magnificationFilter=C.TextureMagnificationFilter.LINEAR;layer.minificationFilter=C.TextureMinificationFilter.LINEAR;return ()=>{if(!viewer.isDestroyed())viewer.imageryLayers.remove(layer,true);};}
export function addReferenceLayers(C:Engine,viewer:Cesium.Viewer,layers:Record<string,boolean>,locale:string,field:CurrentField){const source=new C.CustomDataSource('science-reference');viewer.dataSources.add(source);const cn=locale==='zh-CN';const line=(points:number[][],color:string,width=1,id?:string)=>source.entities.add({id,polyline:{positions:C.Cartesian3.fromDegreesArray(points.flat()),width,clampToGround:false,material:C.Color.fromCssColorString(color)}});
 if(layers.currents)for(const current of CURRENTS){
  const segments=oceanRouteSegments(current.path,(lon,lat)=>isWater(field,lon,lat),8);segments.forEach((points,i)=>line(points,current.kind==='WARM'?'#ecc49688':'#99d5ec88',1.4,'current:'+current.id+':'+i));
 }
 if(layers.graticule){for(let lon=-180;lon<180;lon+=30)line(Array.from({length:85},(_,i)=>[lon,-84+i*2]),'#7cadc355');for(let lat=-60;lat<=60;lat+=30)line(Array.from({length:181},(_,i)=>[-180+i*2,lat]),'#7cadc355');}
 if(layers.windbelts)for(const lat of [-60,-30,0,30,60])line(Array.from({length:181},(_,i)=>[-180+i*2,lat]),'#dca96588',2);
 if(layers.boundaries)loadLand().then(features=>{if(viewer.isDestroyed())return;for(const f of features)eachRing(f.geometry,ring=>line(ring,'#cbdcc77a'));}).catch(()=>{});

 if(layers.divesites)for(const d of DIVE_SITES)source.entities.add({id:'dive:'+d.id,position:C.Cartesian3.fromDegrees(d.lon,d.lat),point:{pixelSize:10,color:C.Color.fromCssColorString('#ffb471'),outlineColor:C.Color.BLACK,outlineWidth:2,heightReference:C.HeightReference.CLAMP_TO_GROUND},label:{text:cn?d.name_cn:d.name_en,font:'12px sans-serif',pixelOffset:new C.Cartesian2(0,-18),fillColor:C.Color.WHITE,style:C.LabelStyle.FILL_AND_OUTLINE,heightReference:C.HeightReference.CLAMP_TO_GROUND}});
 if(useAtlas.getState().mode==='GEOGRAPHY')for(const p of UPWELLING)source.entities.add({position:C.Cartesian3.fromDegrees(p.lon,p.lat),point:{pixelSize:9,color:C.Color.CYAN,heightReference:C.HeightReference.CLAMP_TO_GROUND}});
 return()=>{if(!viewer.isDestroyed())viewer.dataSources.remove(source,true);};
}
export {addFlow} from './screenFlow';

export async function addScienceRasterAsync(C:Engine,viewer:Cesium.Viewer,canvas:HTMLCanvasElement,signal:AbortSignal){
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob||signal.aborted||viewer.isDestroyed())return()=>{};
 const url=URL.createObjectURL(blob),provider=new C.SingleTileImageryProvider({url,tileWidth:canvas.width,tileHeight:canvas.height,rectangle:C.Rectangle.MAX_VALUE});
 const layer=viewer.imageryLayers.addImageryProvider(provider);layer.magnificationFilter=C.TextureMagnificationFilter.LINEAR;layer.minificationFilter=C.TextureMinificationFilter.LINEAR;viewer.scene.requestRender();
 return()=>{if(!viewer.isDestroyed())viewer.imageryLayers.remove(layer,true);URL.revokeObjectURL(url);};
}
