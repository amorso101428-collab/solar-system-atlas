import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addFlow} from '../src/components/earth/screenFlow';
import {buildSyntheticField} from '../src/lib/currentField';
import {useAtlas} from '../src/state/store';
import {useEarthView} from '../src/lib/earthEngine';
const C=new Function(readFileSync('public/vendor/cesium/Cesium.js','utf8')+';return Cesium;')();
const originals={window:globalThis.window,document:globalThis.document,performance:globalThis.performance,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,ResizeObserver:globalThis.ResizeObserver,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
const state=useAtlas.getState();let clock=0,id=0,renders=0;
const frames=new Map<number,FrameRequestCallback>(),timers=new Map<number,()=>void>(),attrs=new Map<string,string>();
const canvas={clientWidth:1440,clientHeight:900,width:1440,height:900};
const documentMock=Object.assign(new EventTarget(),{hidden:false,createElement:()=>canvas});
Object.assign(globalThis,{window:{devicePixelRatio:1},document:documentMock,performance:{now:()=>{clock+=.001;return clock;}},requestAnimationFrame:(fn:FrameRequestCallback)=>{frames.set(++id,fn);return id;},cancelAnimationFrame:(key:number)=>frames.delete(key),setTimeout:(fn:()=>void)=>{timers.set(++id,fn);return id;},clearTimeout:(key:number)=>timers.delete(key),ResizeObserver:class {observe(){}disconnect(){}}});
const scene={mode:C.SceneMode.SCENE3D,canvas,mapProjection:new C.GeographicProjection(),drawingBufferWidth:1440,drawingBufferHeight:900,screenSpaceCameraController:{},requestRender(){renders++;}};
const camera=new C.Camera(scene);camera.setView({destination:C.Cartesian3.fromDegrees(179.65,-7.65,7394200),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});
const transform=new C.Matrix4(),clip=new C.Cartesian4();
const engine={...C,SceneTransforms:{worldToWindowCoordinates(_scene:any,world:any,result:any){C.Matrix4.multiply(camera.frustum.projectionMatrix,camera.viewMatrix,transform);C.Matrix4.multiplyByVector(transform,new C.Cartesian4(world.x,world.y,world.z,1),clip);result.x=(clip.x/clip.w+1)*720;result.y=(1-clip.y/clip.w)*450;return result;}}};
let collection:any;const viewer={scene:{...scene,primitives:{add(p:any){collection=p;return p;},remove(p:any){p.destroy();return true;}}},camera,container:{appendChild(){},setAttribute(k:string,v:string){attrs.set(k,v);},removeAttribute(k:string){attrs.delete(k);}},isDestroyed:()=>false};
let cleanup=()=>{};
const runTimers=()=>{const tasks=[...timers.values()];timers.clear();tasks.forEach(fn=>fn());};
const tick=(ms:number)=>{clock+=ms;const tasks=[...frames.values()];frames.clear();tasks.forEach(fn=>fn(clock));};
try{
 useAtlas.setState({layers:{...state.layers,currents:true,wind:false},time:{...state.time,playing:true},reducedMotion:false});useEarthView.setState({scaleMeters:500000});
 cleanup=addFlow(engine,viewer as any,buildSyntheticField(360,180),null);runTimers();
 for(let i=0;i<80;i++)tick(40);
 assert.ok(Number(attrs.get('data-flow-lines'))>100);assert.ok(collection.length>100);assert.ok(collection.get(0).positions.length>8,'Native globe must receive continuous long paths');const firstPositions=collection.get(0).positions,phase=collection.get(0).material.uniforms.phase;const unique=new Set(Array.from({length:collection.length},(_,i)=>collection.get(i).material));assert.ok(unique.size<=24,'Shared materials bound GPU batches');
 assert.equal(attrs.get('data-flow-rebuilds'),'1');const previous=renders;
 for(let i=0;i<260;i++)tick(40);runTimers();assert.equal(attrs.get('data-flow-rebuilds'),'1','Static camera must never randomly reseed every eight seconds');assert.ok(renders>previous);assert.equal(collection.get(0).positions,firstPositions,'Animation never replaces vertex arrays');assert.notEqual(collection.get(0).material.uniforms.phase,phase,'GPU light trace must move');
 camera.moveStart.raiseEvent();tick(40);assert.ok(collection.length>100,'World-anchored paths remain visible while navigating');camera.moveEnd.raiseEvent();runTimers();for(let i=0;i<80;i++)tick(40);assert.equal(attrs.get('data-flow-rebuilds'),'2');
 useAtlas.getState().setPlaying(false);tick(40);const stopped=renders;for(let i=0;i<10;i++)tick(40);assert.equal(renders,stopped,'Pause stops the overlay loop');
 cleanup();assert.equal(frames.size,0);assert.equal(timers.size,0);assert.equal(attrs.has('data-flow-kind'),false);
 useAtlas.setState({layers:{...state.layers,currents:false,wind:true},time:{...state.time,playing:false}});
 const values=new Float32Array(72*37*3);for(let i=0;i<values.length;i+=3){values[i]=20;values[i+1]=3;}
 const grid={width:72,height:37,lon0:-180,lat0:-90,dLon:5,dLat:5,validTime:'2026-10-03T00:00:00Z',source:'Test vector',displayResolution:'5°',binary:'',values};
 cleanup=addFlow(engine,viewer as any,buildSyntheticField(360,180),grid);runTimers();for(let i=0;i<80;i++)tick(40);
 assert.equal(attrs.get('data-flow-kind'),'wind');assert.ok(collection.length>100);const windPhase=collection.get(0).material.uniforms.phase;tick(100);assert.notEqual(collection.get(0).material.uniforms.phase,windPhase,'Wind animates independently of simulated-current time');cleanup();
 // A startup build cancelled by camera movement must recover even if Cesium
 // never emits moveEnd. This must also work with animation disabled.
 useAtlas.setState({layers:{...state.layers,currents:true,wind:false},time:{...state.time,playing:false},reducedMotion:true});
 cleanup=addFlow(engine,viewer as any,buildSyntheticField(360,180),null);
 camera.moveStart.raiseEvent();runTimers();assert.equal(collection.length,0);
 for(let i=0;i<15;i++)tick(40);runTimers();for(let i=0;i<80;i++)tick(40);
 assert.ok(collection.length>100,'First toggle recovers a cancelled startup without needing moveEnd or another toggle');
 assert.equal(attrs.get('data-flow-rebuilds'),'1');
 const pausedRenders=renders;for(let i=0;i<20;i++)tick(40);assert.equal(renders,pausedRenders,'Recovery watcher must sleep after a paused static build');
 documentMock.hidden=true;documentMock.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0);
 documentMock.hidden=false;documentMock.dispatchEvent(new Event('visibilitychange'));runTimers();for(let i=0;i<80;i++)tick(40);
 assert.ok(collection.length>100);assert.equal(attrs.get('data-flow-rebuilds'),'2');cleanup();assert.equal(frames.size,0);assert.equal(timers.size,0);
 console.log('Cached flow renderer: cancelled startup/missing moveEnd recovery, visibility resume, finite paths, stable motion, pause and cleanup passed.');
}finally{cleanup();Object.assign(globalThis,originals);useAtlas.setState(state,true);}
