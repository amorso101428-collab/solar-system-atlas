import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { worldNow } from '../utils/clock'
import { planetDim } from '../utils/glStats'
/** A separate cloud shell: same UV registration and spin as the surface, ~15 km visual altitude. */
export function EarthClouds({radius,texture}:{radius:number;texture:THREE.Texture|null}) {
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uMap:{value:null},uTime:{value:0},uDim:{value:1}},
    vertexShader:`varying vec2 vUv; varying vec3 p; varying vec3 n; void main(){vUv=uv; vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader:`uniform sampler2D uMap;uniform float uTime;uniform float uDim;varying vec2 vUv;varying vec3 p;varying vec3 n;
    void main(){vec2 uv=vec2(fract(vUv.x+uTime*.00012),vUv.y);float c=texture2D(uMap,uv).r;
      // The map is linear coverage data, not sRGB colour. Keep wispy midtones.
      float coverage=1.-exp(-pow(max(c,0.),1.5)*1.9); if(coverage<.004)discard;
      vec3 N=normalize(n);vec3 L=normalize(-p);vec3 V=normalize(cameraPosition-p);
      float day=pow(max(dot(N,L),0.),.58); float forward=pow(max(dot(-L,V),0.),5.);
      vec3 col=vec3(.87,.92,1.)*(.0015+day*.94)+vec3(.12,.18,.25)*forward*day*.10;
      gl_FragColor=vec4(col*uDim,coverage);
    }`
  }),[])
  useEffect(()=>{material.uniforms.uMap.value=texture},[material,texture])
  useEffect(()=>()=>material.dispose(),[material])
  useFrame(()=>{material.uniforms.uTime.value=worldNow();material.uniforms.uDim.value=planetDim.get('earth')??1})
  if(!texture)return null
  return <mesh><sphereGeometry args={[radius*1.003,128,80]}/><primitive object={material} attach="material"/></mesh>
}
