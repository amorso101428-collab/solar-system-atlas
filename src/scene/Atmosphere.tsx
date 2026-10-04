import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { planetDim } from '../utils/glStats'
export function Atmosphere({radius, id, color}: {radius:number; id:string; color:string}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.BackSide, blending:THREE.AdditiveBlending,
    uniforms:{uColor:{value:new THREE.Color(color)},uDim:{value:1}},
    vertexShader:`varying vec3 n; varying vec3 p; void main(){ vec4 w=modelMatrix*vec4(position,1.); p=w.xyz; n=normalize(mat3(modelMatrix)*normal); gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader:`varying vec3 n; varying vec3 p; uniform vec3 uColor; uniform float uDim;
    void main(){ vec3 N=normalize(n); vec3 V=normalize(cameraPosition-p); vec3 L=normalize(-p);
      float mu=abs(dot(N,V)); float rim=pow(1.-mu,6.);
      float day=smoothstep(-.16,.3,dot(N,L));
      float twilight=exp(-pow(dot(N,L)*10.,2.));
      vec3 tint=mix(uColor,vec3(.72,.25,.08),twilight*.48);
      gl_FragColor=vec4(tint*rim*day*uDim, rim*day*.22);
    }`
  }),[color])
  useEffect(()=>()=>material.dispose(),[material])
  useFrame(()=>{material.uniforms.uDim.value=planetDim.get(id) ?? 1})
  return <mesh scale={id==='earth'?1.006:1.012}><sphereGeometry args={[radius,128,80]}/><primitive object={material} attach="material"/></mesh>
}
