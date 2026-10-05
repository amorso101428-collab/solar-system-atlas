import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useAtlas } from "../state/store";

// Wave spectrum and phase / extinction integration adapted from WaterThreeJS (MIT).
// Attribution and full license: public/credits/WaterThreeJS-MIT.txt.
const VERT=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const COMMON=`precision highp float;uniform float uTime;uniform vec2 uAspect;uniform vec2 uMouse;varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
`;
// A deep-water optical field: the surface is beyond visibility; only diffuse blue light survives.
const VOLUME=COMMON+`uniform float uSteps;
void main(){
 vec2 p=(vUv-.5)*uAspect;vec3 col=vec3(.0014,.0043,.009);
 float mist=0.;
 for(int i=0;i<28;i++){if(float(i)>=uSteps)break;float z=(float(i)+.5)/uSteps;
  vec2 q=p*(.7+z*.3)+vec2(uTime*.007+uMouse.x*.02,z*.55);
  float n=noise(q*2.2+vec2(0.,uTime*.004));
  float halo=exp(-dot((p-vec2(.36,.56))*vec2(.75,.8),(p-vec2(.36,.56))*vec2(.75,.8)))*mix(.6,1.,n);
  mist+=halo*exp(-z*2.4)/uSteps;
 }
 col+=vec3(.009,.027,.042)*mist;
 col+=vec3(.001,.005,.008)*exp(-dot(p-vec2(-.6,-.1),p-vec2(-.6,-.1)));
 gl_FragColor=vec4(col,1.);
}`;
const COMPOSITE=COMMON+`uniform sampler2D uVolume;
vec3 srgb(vec3 c){return mix(c*12.92,1.055*pow(max(c,0.),vec3(1./2.4))-.055,step(vec3(.0031308),c));}
void main(){vec3 col=texture2D(uVolume,vUv).rgb;
 // Small in-focus organisms interspersed with quiet, out-of-focus near and far layers.
 for(int i=0;i<5;i++){
  float f=float(i),scale=18.+f*13.;
  vec2 p=(vUv-.5)*uAspect*scale+uMouse*(.12+f*.07);
  p+=vec2(uTime*.012,-uTime*.018)/(1.+f*.7);
  vec2 cell=floor(p),q=fract(p)-.5;float r=hash(cell+f*31.);
  vec2 offset=vec2(hash(cell+4.7),hash(cell+8.2))*.66-.33;
  q-=offset;float d=dot(q,q);
  float focus=abs(f-2.);float size=.018+focus*.026;
  float core=exp(-d/(size*size));float glow=exp(-d/(size*size*5.));
  float lum=(.45+.55*hash(cell+19.))*(.78+.22*sin(uTime*.22+r*40.));
  float visible=step(.91+f*.012,r);float amp=mix(.015,.09,1.-focus/3.);
  col+=mix(vec3(.18,.42,.48),vec3(.51,.73,.80),r)*(core+glow*.18)*visible*lum*amp;
 }
 vec2 p=(vUv-.5)*vec2(1.,.7);col*=1.-.42*dot(p,p);
 gl_FragColor=vec4(srgb(col),1.);
}`;
export default function Underwater({onError}:{onError:(error:Error)=>void}){
 const canvas=useRef<HTMLCanvasElement>(null);const quality=useAtlas(s=>s.quality),reduced=useAtlas(s=>s.reducedMotion);
 useEffect(()=>{
  if(!canvas.current)return;
  let renderer:THREE.WebGLRenderer|undefined,raf=0,observer:ResizeObserver|undefined;
  let target:THREE.WebGLRenderTarget|undefined,geometry:THREE.PlaneGeometry|undefined,volume:THREE.ShaderMaterial|undefined,final:THREE.ShaderMaterial|undefined;

  let stopped=false;const mouse=new THREE.Vector2(),destination=new THREE.Vector2();
  const node=canvas.current;
  const move=(e:PointerEvent)=>{if(reduced||e.pointerType!=="mouse")return;const r=node.getBoundingClientRect();destination.set((e.clientX-r.left)/r.width-.5,.5-(e.clientY-r.top)/r.height);};
  const lost=(e:Event)=>{e.preventDefault();stopped=true;cancelAnimationFrame(raf);onError(new Error("WebGL context lost"));};
  try{
   if(new URLSearchParams(location.search).get("webgl")==="off")throw new Error("WebGL disabled for compatibility check");
   renderer=new THREE.WebGLRenderer({canvas:node,antialias:false,alpha:false,powerPreference:"high-performance"});
   renderer.debug.onShaderError=(gl,_program,_vertex,fragment)=>{throw new Error("Underwater shader compilation failed: "+gl.getShaderInfoLog(fragment));};
   const floating=renderer.capabilities.isWebGL2 && renderer.extensions.has("EXT_color_buffer_float");
   target=new THREE.WebGLRenderTarget(1,1,{type:floating?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:false});
   const uniforms={uTime:{value:0},uAspect:{value:new THREE.Vector2(1,1)},uMouse:{value:mouse},uSteps:{value:quality==="HIGH"?28:quality==="MEDIUM"?16:8},uVolume:{value:target.texture}};
   volume=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:VOLUME,uniforms,depthTest:false,depthWrite:false});
   final=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:COMPOSITE,uniforms,depthTest:false,depthWrite:false});
   geometry=new THREE.PlaneGeometry(2,2);const quad=new THREE.Mesh(geometry,volume),scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(quad);
   const resize=()=>{if(!renderer||!target)return;const w=Math.max(node.clientWidth,1),h=Math.max(node.clientHeight,1),dpr=Math.min(devicePixelRatio,quality==="HIGH"?1.5:1);
    renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);target.setSize(Math.ceil(w*dpr*.5),Math.ceil(h*dpr*.5));uniforms.uAspect.value.set(w/h,1);};
   observer=new ResizeObserver(resize);observer.observe(node);resize();
   window.addEventListener("pointermove",move);node.addEventListener("webglcontextlost",lost);
   const begin=performance.now();let frames=0,lastMeasure=begin;node.dataset.quality=quality;node.dataset.steps=String(uniforms.uSteps.value);const animate=()=>{if(stopped||!renderer||!target)return;
    try{if(!document.hidden){uniforms.uTime.value=reduced?8:(performance.now()-begin)/1000+8;if(!reduced&&matchMedia("(pointer: coarse)").matches)destination.set(Math.sin(uniforms.uTime.value*.08)*.18,Math.cos(uniforms.uTime.value*.06)*.12);mouse.lerp(destination,.035);
     quad.material=volume!;renderer.setRenderTarget(target);renderer.render(scene,camera);quad.material=final!;renderer.setRenderTarget(null);renderer.render(scene,camera);}
     frames++;const now=performance.now();if(now-lastMeasure>2000){node.dataset.fps=(frames*1000/(now-lastMeasure)).toFixed(1);frames=0;lastMeasure=now;}
     raf=requestAnimationFrame(animate);
    }catch(e){stopped=true;onError(e instanceof Error?e:new Error(String(e)));}
   };animate();
  }catch(e){onError(e instanceof Error?e:new Error(String(e)));}
  return()=>{stopped=true;cancelAnimationFrame(raf);observer?.disconnect();window.removeEventListener("pointermove",move);node.removeEventListener("webglcontextlost",lost);target?.dispose();geometry?.dispose();volume?.dispose();final?.dispose();renderer?.dispose();if(!node.isConnected)renderer?.forceContextLoss();};
 },[quality,reduced,onError]);
 return <canvas className="underwater-canvas" ref={canvas} aria-hidden="true"/>;
}
