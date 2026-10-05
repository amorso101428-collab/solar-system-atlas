import type * as Cesium from 'cesium';
import type {Engine} from '../../lib/earthEngine';
import {useEarthView,MAX_EYE_HEIGHT} from '../../lib/earthEngine';
import {useAtlas} from '../../state/store';
import {AngularMomentum} from '../../../integrations/solar-system-atlas/src/utils/angularMomentum';
const resets=new WeakMap<Cesium.Viewer,()=>void>();
const activeGestures=new WeakMap<Cesium.Viewer,()=>boolean>();
export const earthDragActive=(viewer:Cesium.Viewer)=>activeGestures.get(viewer)?.()||false;
export const stopEarthDrag=(viewer:Cesium.Viewer)=>resets.get(viewer)?.();
/** Both mouse buttons drag around the Earth centre, never translate off it.
 * Touch uses the same orbit with two-finger pinch. Native pinch is disabled so
 * one gesture is never interpreted by two competing controllers. */
export function installEarthDrag(C:Engine,v:Cesium.Viewer,_screenCenter:()=>Cesium.Cartesian3){
 const canvas=v.scene.canvas,controller=v.scene.screenSpaceCameraController;
 controller.rotateEventTypes=[];controller.translateEventTypes=[];controller.lookEventTypes=[];controller.tiltEventTypes=[];
 controller.zoomEventTypes=[C.CameraEventType.WHEEL];controller.inertiaSpin=0;controller.inertiaTranslate=0;v.camera.constrainedAxis=undefined;
 const oldTouchAction=canvas.style?.touchAction;if(canvas.style)canvas.style.touchAction='none';
 const momentum=new AngularMomentum(),touches=new Map<number,{x:number;y:number}>();
 let pointer:number|null=null,lastX=0,lastY=0,middle=false,pressX=0,pressY=0,lastFrame=performance.now()/1000;
 let pendingX=0,pendingY=0,pendingZoom=0;
 activeGestures.set(v,()=>pointer!==null||touches.size>0||momentum.active||!!(pendingX||pendingY||pendingZoom));
 const qx=new C.Quaternion(),qy=new C.Quaternion(),combined=new C.Quaternion(),rotation=new C.Matrix3(),destination=new C.Cartesian3(),direction=new C.Cartesian3(),upAxis=new C.Cartesian3();
 const reset=()=>{momentum.reset();pointer=null;pendingX=pendingY=pendingZoom=0;};resets.set(v,reset);
 const clampEye=()=>{const p=v.camera.positionCartographic;const height=Math.max(30,Math.min(MAX_EYE_HEIGHT,p.height));if(height!==p.height)v.camera.position=C.Cartesian3.fromRadians(p.longitude,p.latitude,height);};
 const apply=(x:number,y:number)=>{
  if(!x&&!y)return;
   // Rotate every world-space component about ZERO, never about a surface pick.
   const scale=Math.max(.000001,Math.min(1,v.camera.positionCartographic.height/3e6));
   C.Quaternion.fromAxisAngle(v.camera.upWC,-x*scale,qx);C.Quaternion.fromAxisAngle(v.camera.rightWC,-y*scale,qy);
   C.Matrix3.fromQuaternion(C.Quaternion.multiply(qy,qx,combined),rotation);
   C.Matrix3.multiplyByVector(rotation,v.camera.positionWC,destination);
   C.Matrix3.multiplyByVector(rotation,v.camera.directionWC,direction);C.Matrix3.multiplyByVector(rotation,v.camera.upWC,upAxis);
   v.camera.setView({destination,orientation:{direction,up:upAxis}});
  clampEye();v.scene.requestRender();
 };
 const pair=()=>{const [a,b]=[...touches.values()];return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};};
 const down=(e:PointerEvent)=>{
  reset();v.camera.cancelFlight();
  if(e.pointerType==='touch'){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);if(touches.size>1)return;}
  if(e.button>2)return;if(e.button===1)e.preventDefault();pointer=e.pointerId;pressX=lastX=e.clientX;pressY=lastY=e.clientY;middle=e.button===1;
  momentum.begin(performance.now()/1000);canvas.setPointerCapture(e.pointerId);
 };
 const move=(e:PointerEvent)=>{
  if(e.pointerType==='touch'&&touches.has(e.pointerId)){
   if(touches.size===2){const before=pair();touches.set(e.pointerId,{x:e.clientX,y:e.clientY});const after=pair();pendingX+=(after.x-before.x)*.00075;pendingY+=(after.y-before.y)*.00085;
    pendingZoom+=Math.log(after.d/before.d);v.scene.requestRender();return;}
   touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  }
  if(e.pointerId!==pointer||middle)return;const x=(e.clientX-lastX)*.00075,y=(e.clientY-lastY)*.00085;lastX=e.clientX;lastY=e.clientY;pendingX+=x;pendingY+=y;momentum.sample(x,y,performance.now()/1000);v.scene.requestRender();
 };
 const up=(e:PointerEvent)=>{
  const multi=touches.size>1;touches.delete(e.pointerId);
  if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
  if(multi){reset();if(touches.size===1){const [id,p]=[...touches][0];pointer=id;lastX=p.x;lastY=p.y;momentum.begin(performance.now()/1000);}return;}if(e.pointerId!==pointer)return;pointer=null;
  if(middle){middle=false;momentum.reset();if(Math.hypot(e.clientX-pressX,e.clientY-pressY)<5)useEarthView.getState().request({kind:'home'});return;}
  momentum.release(performance.now()/1000,useAtlas.getState().reducedMotion);if(momentum.active)v.scene.requestRender();
 };
 const cancel=(e?:PointerEvent)=>{if(e)touches.delete(e.pointerId);reset();};
 const wheel=()=>reset(),aux=(e:MouseEvent)=>{if(e.button===1)e.preventDefault();},blur=()=>{touches.clear();reset();};
 const removeTick=v.scene.preUpdate.addEventListener(()=>{const now=performance.now()/1000,delta=now-lastFrame;lastFrame=now;if(useAtlas.getState().reducedMotion||document.hidden)momentum.reset();
  const queued=!!(pendingX||pendingY||pendingZoom);
  if(queued){const x=pendingX,y=pendingY,z=pendingZoom;pendingX=pendingY=pendingZoom=0;apply(x,y);if(z){const range=Math.max(30,v.camera.positionCartographic.height);v.camera.zoomIn(Math.max(-range*.3,Math.min(range*.3,range*(1-Math.exp(-z)))));clampEye();v.scene.requestRender();}}
  else if(pointer===null&&momentum.active){const d=momentum.step(delta);apply(d.x,d.y);}
 });
 canvas.addEventListener('pointerdown',down);canvas.addEventListener('auxclick',aux);canvas.addEventListener('wheel',wheel,{passive:true});window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);window.addEventListener('blur',blur);
 return()=>{reset();touches.clear();resets.delete(v);activeGestures.delete(v);removeTick();if(canvas.style)canvas.style.touchAction=oldTouchAction||'';canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('auxclick',aux);canvas.removeEventListener('wheel',wheel);window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('blur',blur);};
}
