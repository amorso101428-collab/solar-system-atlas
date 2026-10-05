import { useMemo } from "react";
import * as THREE from "three";
import { SUN_DIRECTION } from "./lighting";
const VERT=`varying vec3 vP; void main(){vec4 p=modelMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const FRAG=`precision highp float;
uniform vec3 sunDir; uniform float planetR,topR,steps; varying vec3 vP;
vec2 hit(vec3 ro,vec3 rd,float r){float b=dot(ro,rd), h=b*b-dot(ro,ro)+r*r; if(h<0.)return vec2(-1.);return vec2(-b-sqrt(h),-b+sqrt(h));}
void main(){
 vec3 ro=cameraPosition,rd=normalize(vP-ro);
 vec2 shell=hit(ro,rd,topR); float a=max(shell.x,0.),b=shell.y;
 vec2 ground=hit(ro,rd,planetR); if(ground.x>0.)b=min(b,ground.x);
 if(b<=a)discard;
 float dt=(b-a)/steps; vec3 tau=vec3(0.),scatter=vec3(0.);
 vec3 beta=vec3(35.,78.,150.); float c=dot(rd,sunDir); float phase=.05968*(1.+c*c);
 for(int i=0;i<24;i++){
  if(float(i)>=steps)break;
  vec3 p=ro+rd*(a+(float(i)+.5)*dt);
  float height=max(length(p)-planetR,0.); float density=exp(-height/.0013);
  vec2 sunlight=hit(p,sunDir,topR); vec2 blocked=hit(p,sunDir,planetR);
  float shadow=(blocked.x>0.)?0.:1.; vec3 sunTau=vec3(0.);
  float ds=max(sunlight.y,0.)/4.;
  for(int j=0;j<4;j++){vec3 q=p+sunDir*(float(j)+.5)*ds;sunTau+=beta*exp(-max(length(q)-planetR,0.)/.0013)*ds;}
  scatter+=exp(-tau-sunTau)*beta*density*dt*phase*shadow*3.5;
  tau+=beta*density*dt;
 }
 float opacity=clamp(1.-exp(-dot(tau,vec3(.333))),0.,.62);
 gl_FragColor=vec4(scatter/max(opacity,.001),opacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function Atmosphere({radius,steps=18}:{radius:number;steps?:number}){
 const uniforms=useMemo(()=>({sunDir:{value:SUN_DIRECTION},planetR:{value:radius},topR:{value:radius*1.018},steps:{value:steps}}),[radius,steps]);
 return <mesh scale={1.018} raycast={()=>null}>
  <sphereGeometry args={[radius,96,64]}/><shaderMaterial vertexShader={VERT} fragmentShader={FRAG} uniforms={uniforms} transparent side={THREE.BackSide} depthWrite={false}/>
 </mesh>;
}
