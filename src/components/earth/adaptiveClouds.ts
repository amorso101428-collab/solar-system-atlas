import type * as Cesium from 'cesium';
import type {Engine} from '../../lib/earthEngine';
import {useAtlas} from '../../state/store';
import {CLOUD_DISPLAY_HEIGHT,cloudVisibility} from '../../lib/cloudHeight';
export function cloudLevel(height:number,quality:string){return quality==='LOW'?Math.min(1,height<4e6?1:0):height<4e6?2:height<8e6?1:0;}
interface Tile {level:number;x:number;y:number;key:string;primitive?:Cesium.Primitive;image?:HTMLImageElement;loading:boolean;failedUntil:number;used:number;}
/** Quadtree coverage has exactly one visible ancestor per patch. Child textures
 * replace their parent only as a complete ready quartet, without whitening
 * the same cloud twice. Loading and GPU uploads are bounded and cancellable. */
export function installAdaptiveClouds(C:Engine,v:Cesium.Viewer,quality:string,onError:(failed:boolean)=>void){
 const host=v.container as HTMLElement;
 const tiles=new Map<string,Tile>(),queue:Tile[]=[];let alive=true,inflight=0,moving=false,settled=0,opacity=0,frame=0,lastPlan=0,wake:ReturnType<typeof setTimeout>|undefined,needsFrame=false,dirty=true;
 const cameraPosition=C.Cartesian3.clone(v.camera.positionWC),cameraDirection=C.Cartesian3.clone(v.camera.directionWC);
 const limit=quality==='LOW'?40:quality==='MEDIUM'?64:96;
 const rectangle=(t:Tile)=>{const nx=4*2**t.level,ny=2*2**t.level;return C.Rectangle.fromDegrees(-180+t.x*360/nx,90-(t.y+1)*180/ny,-180+(t.x+1)*360/nx,90-t.y*180/ny);};
 const tile=(level:number,x:number,y:number)=>{const key=`${level}/${x}-${y}`;let t=tiles.get(key);if(!t){t={level,x,y,key,loading:false,failedUntil:0,used:frame};tiles.set(key,t);}t.used=frame;return t;};
 const children=(t:Tile)=>[tile(t.level+1,t.x*2,t.y*2),tile(t.level+1,t.x*2+1,t.y*2),tile(t.level+1,t.x*2,t.y*2+1),tile(t.level+1,t.x*2+1,t.y*2+1)];
 const roots=Array.from({length:8},(_,i)=>tile(0,i%4,Math.floor(i/4)));
 const create=(t:Tile,image:HTMLImageElement)=>{
  const material=new C.Material({fabric:{type:'AtlasCloudTile',uniforms:{image,opacity:0},source:`czm_material czm_getMaterial(czm_materialInput i){czm_material m=czm_getDefaultMaterial(i);vec2 uv=(i.st*512.0+2.0)/516.0;vec4 c=texture(image,uv);m.diffuse=vec3(0.0);m.emission=vec3(1.0);m.alpha=c.a*opacity;return m;}`},translucent:true});
  const geometry=new C.RectangleGeometry({rectangle:rectangle(t),height:CLOUD_DISPLAY_HEIGHT,granularity:C.Math.toRadians(1.5),vertexFormat:C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat});
  t.primitive=v.scene.primitives.add(new C.Primitive({geometryInstances:new C.GeometryInstance({geometry}),appearance:new C.MaterialAppearance({material,flat:true,faceForward:false,translucent:true,renderState:{depthTest:{enabled:true},depthMask:false,cull:{enabled:true,face:C.CullFace.BACK}}}),allowPicking:false,asynchronous:false}));
 };
 const schedule=()=>{clearTimeout(wake);wake=setTimeout(()=>{if(alive&&!v.isDestroyed()){dirty=true;v.scene.requestRender();}},180);};
 const pump=()=>{if(!alive)return;while(inflight<2&&queue.length){const t=queue.shift()!;if(t.primitive||t.loading||t.failedUntil>performance.now())continue;t.loading=true;inflight++;const image=new Image();image.decoding='async';t.image=image;
  image.onload=async()=>{try{await image.decode();}catch{}if(!alive)return;t.loading=false;inflight--;create(t,image);dirty=true;onError(false);v.scene.requestRender();schedule();pump();};
  image.onerror=()=>{if(!alive)return;t.loading=false;inflight--;t.failedUntil=performance.now()+30000;if(t.level===0)onError(true);v.scene.requestRender();schedule();pump();};
  image.src='/earth/cloud-tiles/'+t.key+'.webp?v=20261002-1';
 }};
 const request=(t:Tile)=>{if((t.level===0||!moving&&performance.now()-settled>=240)&&!t.primitive&&!t.loading&&t.failedUntil<=performance.now()&&!queue.includes(t))queue.push(t);};
 const alpha=(t:Tile,a:number)=>{if(!t.primitive)return;const p=t.primitive,show=a>0||!p.ready;if(p.show!==show)p.show=show;const uniforms=(p.appearance as Cesium.MaterialAppearance).material.uniforms;if(uniforms.opacity!==a)uniforms.opacity=a;};
 const relevant=(t:Tile,view:Cesium.Rectangle|undefined)=>!view||Boolean(C.Rectangle.intersection(rectangle(t),view));
 const plan=()=>{
  frame++;needsFrame=false;queue.length=0;const height=v.camera.positionCartographic.height,st=useAtlas.getState();opacity=st.layers.clouds?cloudVisibility(height):0;
  const visible=new Set<Tile>();
  host.dataset.cloudOpacity=opacity.toFixed(3);
  if(opacity===0){for(const t of tiles.values())alpha(t,0);host.dataset.cloudLevel='hidden';host.dataset.cloudVisibleLevels='';host.dataset.cloudTiles='0';return;}
  // Keep cached fine coverage while a moving camera defers new fine uploads.
  const level=cloudLevel(height,quality),view=v.camera.computeViewRectangle();
  const visit=(t:Tile):void=>{if(!relevant(t,view))return;t.used=frame;request(t);if(!t.primitive?.ready)needsFrame=true;
   if(t.level<level&&t.primitive?.ready){const next=children(t);next.forEach(request);if(!moving&&next.some(child=>!child.primitive?.ready))needsFrame=true;if(next.every(child=>child.primitive?.ready)){next.forEach(visit);return;}}
   visible.add(t);
  };
  roots.forEach(visit);
  // Do not switch every primitive off/on during each camera update. A stable
  // visible set lets explicit rendering sleep instead of invalidating all tiles.
  for(const t of tiles.values())alpha(t,visible.has(t)?opacity:0);
  const keep=[...tiles.values()].filter(t=>t.primitive&&!t.loading&&t.level>0&&t.used<frame-1).sort((a,b)=>a.used-b.used);
  while([...tiles.values()].filter(t=>t.primitive).length>limit&&keep.length){const t=keep.shift()!;v.scene.primitives.remove(t.primitive!);t.primitive=undefined;if(t.image)t.image.src='';t.image=undefined;tiles.delete(t.key);}
  host.dataset.cloudLevel=String(level);
  host.dataset.cloudVisibleLevels=[...new Set([...tiles.values()].filter(t=>t.primitive?.show&&(t.primitive.appearance as Cesium.MaterialAppearance).material.uniforms.opacity>0).map(t=>t.level))].sort().join(',');
  host.dataset.cloudTiles=String([...tiles.values()].filter(t=>t.primitive?.show&&(t.primitive.appearance as Cesium.MaterialAppearance).material.uniforms.opacity>0).length);
  pump();if(needsFrame||inflight>0||!moving&&performance.now()-settled<300)schedule();
 };
 const start=v.camera.moveStart.addEventListener(()=>{moving=true;dirty=true;});
 const end=v.camera.moveEnd.addEventListener(()=>{moving=false;settled=performance.now();dirty=true;schedule();});
 const pre=v.scene.preUpdate.addEventListener(()=>{const now=performance.now(),changed=!C.Cartesian3.equalsEpsilon(cameraPosition,v.camera.positionWC,0,.5)||!C.Cartesian3.equalsEpsilon(cameraDirection,v.camera.directionWC,0,1e-8);if(changed)dirty=true;if(!dirty||now-lastPlan<(moving?240:120))return;dirty=false;lastPlan=now;C.Cartesian3.clone(v.camera.positionWC,cameraPosition);C.Cartesian3.clone(v.camera.directionWC,cameraDirection);plan();});
 const state=useAtlas.subscribe((s,p)=>{if(s.layers.clouds!==p.layers.clouds){dirty=true;lastPlan=0;v.scene.requestRender();}});
 plan();return()=>{alive=false;clearTimeout(wake);start();end();pre();state();queue.length=0;for(const t of tiles.values()){if(t.image){t.image.onload=t.image.onerror=null;t.image.src='';}if(t.primitive&&!v.isDestroyed())v.scene.primitives.remove(t.primitive);}tiles.clear();};
}
