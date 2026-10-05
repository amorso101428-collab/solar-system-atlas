import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {useEarthView} from '../src/lib/earthEngine';
import {installEarthDrag,stopEarthDrag,earthDragActive} from '../src/components/earth/dragController';
// Use the packaged Cesium camera/matrices, without needing a WebGL context.
const C=new Function(readFileSync('public/vendor/cesium/Cesium.js','utf8')+';return Cesium;')();
class Canvas extends EventTarget {
  clientWidth=1280;clientHeight=720;captured=new Set<number>();
  setPointerCapture(id:number){this.captured.add(id);}
  releasePointerCapture(id:number){this.captured.delete(id);}
  hasPointerCapture(id:number){return this.captured.has(id);}
}
const previousWindow=globalThis.window,previousPerformance=globalThis.performance;
let clock=1;
const events=new EventTarget(),canvas=new Canvas();
Object.assign(globalThis,{window:events,document:{hidden:false},performance:{now:()=>clock*1000}});
const controller={zoomEventTypes:['wheel','pinch']};
const scene={mode:C.SceneMode.SCENE3D,canvas,mapProjection:new C.GeographicProjection(),drawingBufferWidth:1280,drawingBufferHeight:720,screenSpaceCameraController:controller,preUpdate:new C.Event(),requestRender:()=>{}};
const camera=new C.Camera(scene),v={scene,camera};
let pivot=C.Cartesian3.fromDegrees(28,-8);
const globalView=()=>camera.setView({destination:C.Cartesian3.fromDegrees(28,-8,19000000),orientation:{heading:0,pitch:-Math.PI/2,roll:0}});
globalView();
let surfacePicks=0;const remove=installEarthDrag(C,v as any,()=>{surfacePicks++;return pivot;});
const position=()=>C.Cartesian3.clone(camera.positionWC);
const distance=(a:any,b:any)=>C.Cartesian3.distance(a,b);
const pointer=(type:string,x:number,y:number,button=0,options:Record<string,unknown>={},render=true)=>{
  const event=new Event(type);
  Object.assign(event,{pointerId:1,pointerType:'mouse',clientX:x,clientY:y,button,ctrlKey:false,shiftKey:false,...options});
  (type==='pointerdown'?canvas:events).dispatchEvent(event);
  if(type==='pointermove'&&render)scene.preUpdate.raiseEvent();
};
const tick=(seconds:number)=>{clock+=seconds;scene.preUpdate.raiseEvent();};
try {
  const originalPosition=position(),originalPicks=surfacePicks;
  pointer('pointerdown',600,360);clock+=.04;
  for(let i=1;i<=8;i++)pointer('pointermove',600+i*4,360,0,{},false);
  assert.ok(distance(originalPosition,position())<.001,'Raw events must not immediately traverse the scene');
  tick(.016);assert.ok(distance(originalPosition,position())>100);assert.equal(surfacePicks-originalPicks,0,'Earth-centred drag does not traverse terrain');
  clock+=.04;pointer('pointermove',640,360);assert.equal(surfacePicks-originalPicks,0,'Drag does not need surface picks');
  assert.equal(earthDragActive(v as any),true);pointer('pointercancel',640,360);assert.equal(earthDragActive(v as any),false);globalView();
  // Fast movement gives a short coast, and the next press immediately brakes it.
  pointer('pointerdown',600,360);clock+=.05;pointer('pointermove',720,360);pointer('pointerup',720,360);
  const released=position();tick(.04);const first=position();tick(.04);const second=position();
  assert.ok(distance(released,first)>100);
  assert.ok(distance(first,second)<distance(released,first));
  pointer('pointerdown',720,360);const braked=position();tick(.1);assert.ok(distance(braked,position())<.001);
  pointer('pointercancel',720,360);
  // Slow adjustment settles without a release throw, even after a long drag.
  globalView();clock+=1;pointer('pointerdown',600,360);clock+=2;pointer('pointermove',620,360);pointer('pointerup',620,360);
  const slow=position();for(let i=0;i<60;i++)tick(1/60);assert.ok(distance(slow,position())<.001);
  // Left drag stays centred, rotating camera orientation with the globe.
  globalView();const direction=C.Cartesian3.clone(camera.directionWC),right=C.Cartesian3.clone(camera.rightWC),upAxis=C.Cartesian3.clone(camera.upWC),beforePan=position();
  pointer('pointerdown',600,360);clock+=1;pointer('pointermove',620,380);pointer('pointerup',620,380);
  const translated=C.Cartesian3.subtract(position(),beforePan,new C.Cartesian3());
  assert.ok(C.Cartesian3.dot(translated,right)<0,'Rightward left-drag pans opposite the camera right vector');
  assert.ok(C.Cartesian3.dot(translated,upAxis)>0,'Downward left-drag pans along the camera up vector');
  assert.ok(C.Cartesian3.distance(direction,camera.directionWC)>1e-8,'Left drag rotates rather than translating off the globe');
  assert.ok(Math.abs(C.Cartesian3.magnitude(position())-C.Cartesian3.magnitude(beforePan))<.01,'Left drag preserves distance to Earth centre');
  // Both buttons orbit in every direction; none can translate off the globe.
  for(const button of [0,2])for(const [dx,dy,axis,sign] of [[30,0,'rightWC',-1],[-30,0,'rightWC',1],[0,30,'upWC',1],[0,-30,'upWC',-1]] as const){
   globalView();const origin=position(),basis=C.Cartesian3.clone(camera[axis]);pointer('pointerdown',600,360,button);clock+=1;pointer('pointermove',600+dx,360+dy,button);pointer('pointerup',600+dx,360+dy,button);
   assert.ok(C.Cartesian3.dot(C.Cartesian3.subtract(position(),origin,new C.Cartesian3()),basis)*sign>0,'Both mouse buttons move in matching directions');
   assert.ok(Math.abs(C.Cartesian3.magnitude(position())-C.Cartesian3.magnitude(origin))<.01,'All drag directions preserve geocentric radius');
  }
  pointer('pointerdown',600,360,1);pointer('pointerup',600,360,1);assert.equal(useEarthView.getState().command?.kind,'home');
  const homeKey=useEarthView.getState().command?.key;clock+=1;pointer('pointerdown',600,360,1);pointer('pointerup',620,360,1);assert.equal(useEarthView.getState().command?.key,homeKey,'Middle drag is not a home click');
  // Right drag preserves geocentric radius and camera orientation relative to ZERO,
  // even at an oblique near-surface pose. Surface-pivot range is not the invariant.
  pivot=C.Cartesian3.fromDegrees(-112.1,36.1,1500);
  camera.lookAt(pivot,new C.HeadingPitchRange(.7,-.9,80000));camera.lookAtTransform(C.Matrix4.IDENTITY);
  const near=position(),radius=C.Cartesian3.magnitude(near),alignment=C.Cartesian3.dot(C.Cartesian3.normalize(near,new C.Cartesian3()),camera.directionWC);
  clock+=1;pointer('pointerdown',600,360,2);clock+=.04;pointer('pointermove',601,361,2);
  assert.ok(distance(near,position())<1000,'Right drag must not jump on its first movement');
  assert.ok(Math.abs(C.Cartesian3.magnitude(position())-radius)<.01,'Orbit must preserve distance to Earth core');
  assert.ok(Math.abs(C.Cartesian3.dot(C.Cartesian3.normalize(position(),new C.Cartesian3()),camera.directionWC)-alignment)<1e-10,'Geocentric orientation preserved');
  pointer('pointerup',601,361,2);
  stopEarthDrag(v as any);const stopped=position();for(let i=0;i<20;i++)tick(.02);assert.ok(distance(stopped,position())<.001);
  assert.deepEqual(controller.zoomEventTypes,[C.CameraEventType.WHEEL],'Native pinch disabled to avoid competing gestures');
  globalView();const trackpadStart=position();pointer('pointerdown',600,360,0,{shiftKey:true});clock+=1;pointer('pointermove',640,360,0,{shiftKey:true});pointer('pointerup',640,360,0,{shiftKey:true});assert.ok(Math.abs(C.Cartesian3.magnitude(trackpadStart)-C.Cartesian3.magnitude(position()))<.01);
  globalView();const touchStart=position();pointer('pointerdown',500,300,0,{pointerType:'touch',pointerId:2});clock+=1;pointer('pointermove',530,320,0,{pointerType:'touch',pointerId:2});assert.ok(distance(touchStart,position())>100);assert.ok(Math.abs(C.Cartesian3.magnitude(touchStart)-C.Cartesian3.magnitude(position()))<.01);
  pointer('pointerdown',650,320,0,{pointerType:'touch',pointerId:3});const pinchHeight=camera.positionCartographic.height;pointer('pointermove',720,320,0,{pointerType:'touch',pointerId:3});assert.ok(camera.positionCartographic.height<pinchHeight,'Spreading two fingers zooms in');pointer('pointerup',720,320,0,{pointerType:'touch',pointerId:3});pointer('pointerup',530,320,0,{pointerType:'touch',pointerId:2});stopEarthDrag(v as any);
  remove();const detached=position();pointer('pointerdown',600,360);clock+=.05;pointer('pointermove',800,360);tick(.04);assert.ok(distance(detached,position())<.001);
  console.log('Cesium drag: fast coast, slow settling, brake/cancel, geocentric orbit, trackpad and touch navigation and cleanup passed.');
} finally {
  remove();Object.assign(globalThis,{window:previousWindow,performance:previousPerformance});delete (globalThis as any).document;
}
