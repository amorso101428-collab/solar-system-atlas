import type * as Cesium from 'cesium';
import type {Engine} from '../../lib/earthEngine';
import {useEarthView} from '../../lib/earthEngine';
import {useAtlas} from '../../state/store';
import {isWater,sampleUV,type CurrentField} from '../../lib/currentField';
import {sampleWeather,type WeatherGrid} from '../../lib/weatherGrid';
import {flowBudget,flowStep,type FlowPoint} from '../../lib/streamline';

/** Cache geographic streamlines after navigation settles. Shared GPU materials
 * move their light traces without per-frame mesh replacement or visibility toggles. */
export function addFlow(C:Engine,v:Cesium.Viewer,field:CurrentField,grid:WeatherGrid|null){
 const initial=useAtlas.getState(),wind=initial.layers.wind;
 if((!wind&&!initial.layers.currents)||(wind&&!grid))return()=>{};
 const surface=v.scene.canvas,collection=new C.PolylineCollection();v.scene.primitives.add(collection);
 const ellipsoid=C.Ellipsoid.WGS84,scaledCamera=new C.Cartesian3(),scaledPoint=new C.Cartesian3(),world=new C.Cartesian3(),screen=new C.Cartesian2();
 const occluder=new C.Occluder(new C.BoundingSphere(C.Cartesian3.ZERO,1),ellipsoid.transformPositionToScaledSpace(v.camera.positionWC,scaledCamera));
 type Path={positions:Cesium.Cartesian3[];material:number};
 const materials=Array.from({length:24},(_,i)=>new C.Material({fabric:{type:'AtlasStreamline',uniforms:{phase:(i%6)/6},source:`czm_material czm_getMaterial(czm_materialInput i){czm_material m=czm_getDefaultMaterial(i);float s=i.st.s;float behind=fract(phase-s);float trace=1.0-smoothstep(0.015,0.34,behind);float ends=smoothstep(0.0,0.08,s)*smoothstep(0.0,0.08,1.0-s);m.diffuse=vec3(0.0);m.emission=vec3(0.76,0.92,1.0);m.alpha=(0.13+trace*0.72)*ends;return m;}`},translucent:true}));
 const rates=wind?[.06,.10,.16,.23]:[.08,.12,.16,.20];
 let lift=1200,paths:Path[]=[],alive=true,moving=false,needsBuild=true,generation=0,frame=0,buildFrame=0,timer:ReturnType<typeof setTimeout>,w=0,h=0,last=0,rebuilds=0,lastCameraChange=performance.now();
 const cameraPosition=C.Cartesian3.clone(v.camera.positionWC),cameraDirection=C.Cartesian3.clone(v.camera.directionWC),cameraUp=C.Cartesian3.clone(v.camera.upWC);
 let style=flowBudget(surface.clientWidth,surface.clientHeight,initial.quality,wind);
 const attr=(key:string,value:string)=>v.container.setAttribute('data-flow-'+key,value);
 attr('kind',wind?'wind':'currents');attr('width',String(style.width));attr('fps',String(style.fps));
 const velocity=(lon:number,lat:number)=>wind&&grid?sampleWeather(grid,lon,lat):sampleUV(field,lon,lat);
 const valid=(lon:number,lat:number)=>Math.abs(lat)<88&&(wind||isWater(field,lon,lat));
 const projected=(lon:number,lat:number)=>{
  C.Cartesian3.fromDegrees(lon,lat,lift,ellipsoid,world);
  if(!occluder.isPointVisible(ellipsoid.transformPositionToScaledSpace(world,scaledPoint)))return null;
  const p=C.SceneTransforms.worldToWindowCoordinates(v.scene,world,screen);
  return p&&p.x>-30&&p.y>-30&&p.x<w+30&&p.y<h+30?{x:p.x,y:p.y}:null;
 };
 const build=()=>{
  if(!alive||moving||document.hidden||v.isDestroyed())return;const version=++generation;cancelAnimationFrame(buildFrame);buildFrame=0;
  w=surface.clientWidth;h=surface.clientHeight;style=flowBudget(w,h,initial.quality,wind);
  occluder.cameraPosition=ellipsoid.transformPositionToScaledSpace(v.camera.positionWC,scaledCamera);
  const s=useEarthView.getState(),mpp=s.scaleMeters>0?s.scaleMeters/100:Math.max(1,v.camera.positionCartographic.height)*1.155/Math.max(1,h);
  lift=Math.min(1200,Math.max(2,v.camera.positionCartographic.height*.02))+(4*mpp)**2/(8*6378137);
  const cells:Array<[number,number]>=[];for(let y=style.spacing*.5;y<h;y+=style.spacing)for(let x=style.spacing*.5;x<w;x+=style.spacing)cells.push([x,y]);
  const pending:Path[]=[],occupied=new Set<string>();let cursor=0;
  const batch=()=>{
   buildFrame=0;if(!alive||version!==generation)return;const until=performance.now()+5;
   while(cursor<cells.length&&pending.length<style.count&&performance.now()<until){
    const index=cursor++,[x,y]=cells[index],jitter=Math.sin(index*127.1)*style.spacing*.22;
    const p=v.camera.pickEllipsoid(new C.Cartesian2(x+jitter,y-jitter),ellipsoid);if(!p)continue;
    const geo=C.Cartographic.fromCartesian(p),lon=C.Math.toDegrees(geo.longitude),lat=C.Math.toDegrees(geo.latitude);if(!valid(lon,lat))continue;
    let a=lon,b=lat;const step=4*mpp;
    for(let i=0;i<10;i++){const next=flowStep(a,b,-step,velocity);if(!valid(...next))break;[a,b]=next;}
    const points:FlowPoint[]=[],positions:Cesium.Cartesian3[]=[];let length=0;
    for(let i=0;i<100&&length<style.length;i++){
     if(!valid(a,b))break;const pixel=projected(a,b);if(!pixel)break;const prev=points[points.length-1];
     if(prev){const distance=Math.hypot(pixel.x-prev.x,pixel.y-prev.y);if(distance>25||distance<.01)break;length+=distance;}
     points.push({...pixel,distance:length});positions.push(C.Cartesian3.fromDegrees(a,b,lift));[a,b]=flowStep(a,b,step,velocity);
    }
    if(length<28)continue;
    // Spatial reservation is evaluated once when constructing paths, never
    // toggled each animation frame. Prevents bright knots at convergent flows.
    const mid=points[Math.floor(points.length/2)],key=Math.floor(mid.x/(style.spacing*.55))+':'+Math.floor(mid.y/(style.spacing*.55));if(occupied.has(key))continue;occupied.add(key);
    const vector=velocity(lon,lat),speed=Math.hypot(vector[0],vector[1]);
    pending.push({positions,material:Math.min(3,Math.floor(speed/(wind?7:.35)))*6+index%6});
   }
   if(cursor<cells.length&&pending.length<style.count){buildFrame=requestAnimationFrame(batch);return;}
   needsBuild=false;paths=pending;collection.removeAll();for(let i=0;i<paths.length;i++)collection.add({positions:paths[i].positions,width:style.width,material:materials[paths[i].material]});attr('lines',String(paths.length));attr('seeds',String(paths.length));attr('rebuilds',String(++rebuilds));draw(performance.now(),true);kick();
  };batch();
 };
 const draw=(now:number,force=false)=>{
  const st=useAtlas.getState(),animate=!st.reducedMotion&&(wind||st.time.playing),dt=force?0:Math.min(.1,(now-last)/1000);last=now;
  const start=performance.now();if(animate)for(let i=0;i<materials.length;i++)materials[i].uniforms.phase=(materials[i].uniforms.phase+dt*rates[Math.floor(i/6)]*(wind?1:Math.min(3,Math.sqrt(st.time.rate))))%1;
  v.scene.requestRender();
  attr('frame-ms',(performance.now()-start).toFixed(2));
 };
 // Startup and cancelled builds must keep the scene awake too. In explicit
 // render mode a camera end event alone cannot reliably restart an empty layer.
 const tick=(now:number)=>{frame=0;if(!alive||document.hidden||v.isDestroyed())return;
  const changed=!C.Cartesian3.equalsEpsilon(cameraPosition,v.camera.positionWC,0,.02)||!C.Cartesian3.equalsEpsilon(cameraDirection,v.camera.directionWC,0,1e-9)||!C.Cartesian3.equalsEpsilon(cameraUp,v.camera.upWC,0,1e-9);
  if(changed){C.Cartesian3.clone(v.camera.positionWC,cameraPosition);C.Cartesian3.clone(v.camera.directionWC,cameraDirection);C.Cartesian3.clone(v.camera.upWC,cameraUp);lastCameraChange=now;if(!moving){moving=true;invalidate();}}
  if(moving&&now-lastCameraChange>=240){moving=false;schedule();}
  if(now-last>=1000/style.fps)draw(now);const s=useAtlas.getState();if(needsBuild||moving||!s.reducedMotion&&(wind||s.time.playing))kick();
 };
 const kick=()=>{if(!frame&&!document.hidden&&alive)frame=requestAnimationFrame(tick);};
 const clear=()=>{generation++;cancelAnimationFrame(buildFrame);cancelAnimationFrame(frame);frame=0;paths=[];collection.removeAll();attr('lines','0');};
 const invalidate=()=>{needsBuild=true;generation++;cancelAnimationFrame(buildFrame);buildFrame=0;clearTimeout(timer);kick();};
 const schedule=()=>{needsBuild=true;clearTimeout(timer);timer=setTimeout(build,200);v.scene.requestRender();kick();};
 const offStart=v.camera.moveStart.addEventListener(()=>{moving=true;lastCameraChange=performance.now();invalidate();});
 const offEnd=v.camera.moveEnd.addEventListener(()=>{if(!moving&&!needsBuild)return;moving=false;schedule();});
 const observer=new ResizeObserver(()=>{invalidate();schedule();});observer.observe(surface);
 const visibility=()=>{if(document.hidden){generation++;cancelAnimationFrame(buildFrame);buildFrame=0;cancelAnimationFrame(frame);frame=0;clearTimeout(timer);}else{last=performance.now();schedule();}};document.addEventListener('visibilitychange',visibility);
 const unsubscribe=useAtlas.subscribe((s,p)=>{if(s.time.playing!==p.time.playing||s.reducedMotion!==p.reducedMotion){draw(performance.now(),true);kick();}});
 schedule();return()=>{if(!alive)return;alive=false;clear();clearTimeout(timer);offStart();offEnd();observer.disconnect();unsubscribe();document.removeEventListener('visibilitychange',visibility);if(!v.isDestroyed())v.scene.primitives.remove(collection);for(const key of ['kind','width','fps','lines','seeds','rebuilds','frame-ms'])v.container.removeAttribute('data-flow-'+key);};
}
