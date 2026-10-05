import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import type {PlaceKind,PlaceLabel} from './geographicLabels';
const TILEJSON='https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json';
let template:Promise<string>|null=null;
const cache=new Map<string,PlaceLabel[]>();
export function slippyTile(lon:number,lat:number,z:number){const n=2**z,y=(1-Math.asinh(Math.tan(Math.max(-85.05,Math.min(85.05,lat))*Math.PI/180))/Math.PI)/2*n;return {z,x:((Math.floor((lon+180)/360*n)%n)+n)%n,y:Math.max(0,Math.min(n-1,Math.floor(y)))};}
export function tileLonLat(x:number,y:number,z:number){const n=2**z;return {lon:x/n*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/n)))*180/Math.PI};}
export function decodePlaceTile(bytes:Uint8Array,x:number,y:number,z:number):PlaceLabel[] {
 const tile=new VectorTile(new PbfReader(bytes)),result:PlaceLabel[]=[];
 for(const key of ['place','water_name','waterway','mountain_peak','park','transportation_name','poi','aerodrome_label']){
  const layer=tile.layers[key];if(!layer)continue;
  for(let i=0;i<layer.length;i++){
   const f=layer.feature(i),p=f.properties,base=String(p.name??'');if(!base)continue;
   const cn=String(p['name:zh-Hans']||p['name:zh']||p.name_zh||base),en=String(p['name:en']||p.name_en||p['name:latin']||p.name_int||base);
   const c=String(p.class??''),road=key==='transportation_name',poi=key==='poi'||key==='aerodrome_label';
   const kind:PlaceKind=road?'road':poi?'poi':key==='place'?(c==='city'||c==='town'?'city':'region'):'nature';
   const landmark=poi&&(key==='aerodrome_label'||['attraction','museum','castle','monument','stadium','college','hospital','railway','airport'].includes(c));
   const minZoom=road?(['motorway','trunk','primary'].includes(c)?12:13):poi?(landmark?13:15):key==='place'?(c==='city'?5:c==='town'?9:11):10;
   if(z<minZoom)continue;
   const paths=f.loadGeometry();let path=paths.reduce((a,b)=>a.length>b.length?a:b,[] as typeof paths[number]);if(!path.length)continue;
   let point=path[0];
   if(f.type===2){let total=0;for(let j=1;j<path.length;j++)total+=Math.hypot(path[j].x-path[j-1].x,path[j].y-path[j-1].y);let walked=0;for(let j=1;j<path.length;j++){const length=Math.hypot(path[j].x-path[j-1].x,path[j].y-path[j-1].y);if(walked+length>=total/2){const a=path[j-1],b=path[j],t=length?(total/2-walked)/length:0;point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t} as typeof point;break;}walked+=length;}}
   if(f.type===3){const b=f.bbox();point={x:(b[0]+b[2])/2,y:(b[1]+b[3])/2} as typeof point;}
   if(point.x<0||point.x>f.extent||point.y<0||point.y>f.extent)continue;
   const coordinate=tileLonLat(x+point.x/f.extent,y+point.y/f.extent,z);
   result.push({id:`local:${key}:${f.id??i}:${x}:${y}:${z}`,kind,cn,en,...coordinate,rank:kind==='city'?1:kind==='region'?3:landmark?2.5+Math.min(.4,Number(p.rank||0)/100):road?5:6+Number(p.rank||0)/100,minZoom});
  }
 }
 return result.sort((a,b)=>a.rank-b.rank).slice(0,700);
}
export async function loadPlaceTile(tile:{z:number;x:number;y:number},signal:AbortSignal) {
 const {z,x,y}=tile,key=`${z}/${x}/${y}`,saved=cache.get(key);if(saved){cache.delete(key);cache.set(key,saved);return saved;}
 if(!template)template=fetch(TILEJSON,{signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok)throw Error('Place service unavailable');const j=await r.json();const url=j.tiles?.[0];if(typeof url!=='string'||!url.startsWith('https://'))throw Error('Invalid place tile source');return url;}).catch(error=>{template=null;throw error;});
 const url=(await template).replace('{z}',String(z)).replace('{x}',String(x)).replace('{y}',String(y));
 const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});if(!response.ok)throw Error('Place tile unavailable');
 let bytes=new Uint8Array(await response.arrayBuffer());
 // Fetch normally decompresses Content-Encoding. Handle a raw gzip tile too.
 if(bytes[0]===31&&bytes[1]===139){const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));bytes=new Uint8Array(await new Response(stream).arrayBuffer());}
 const names=decodePlaceTile(bytes,x,y,z);cache.set(key,names);while(cache.size>36)cache.delete(cache.keys().next().value!);return names;
}
