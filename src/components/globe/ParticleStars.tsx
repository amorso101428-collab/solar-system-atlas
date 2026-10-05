import {useMemo,useRef,useEffect} from 'react';
import {useFrame,type ThreeEvent} from '@react-three/fiber';
import * as THREE from 'three';
import {useAtlas} from '../../state/store';
import {useLanguage} from '../../i18n';
/** A seeded spherical particle environment, not an astronomical catalog. */
export default function ParticleStars(){const ref=useRef<THREE.Points>(null),{t}=useLanguage(),reduced=useAtlas(s=>s.reducedMotion);
 const data=useMemo(()=>{const n=3600,pos=new Float32Array(n*3),size=new Float32Array(n),phase=new Float32Array(n);let seed=73477;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};for(let i=0;i<n;i++){const y=random()*2-1,a=random()*Math.PI*2,r=26+random()*12,s=Math.sqrt(1-y*y);pos.set([r*s*Math.cos(a),r*y,r*s*Math.sin(a)],i*3);size[i]=1.2+random()**3*3.0;phase[i]=random()*6.28;}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aSize',new THREE.BufferAttribute(size,1));geo.setAttribute('aPhase',new THREE.BufferAttribute(phase,1));return geo;},[]);
 const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},ratio:{value:1}},vertexShader:`attribute float aSize,aPhase;uniform float time,ratio;varying float glow;void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=aSize*ratio;glow=.74+.2*sin(aPhase+time*.32);}`,fragmentShader:`varying float glow;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float core=exp(-d*d*20.);gl_FragColor=vec4(mix(vec3(.57,.72,.9),vec3(1.,.9,.74),glow),core*glow);}`}),[]);
 useEffect(()=>()=>{data.dispose();material.dispose();},[data,material]);useFrame(({gl},dt)=>{material.uniforms.ratio.value=gl.getPixelRatio();if(!reduced)material.uniforms.time.value+=Math.min(dt,.1);});
 const hover=(e:ThreeEvent<PointerEvent>)=>{if(e.distance<5)return;useAtlas.getState().setHover({label:t('星空粒子','Particle stars'),sub:t('拖动视角观察空间 · 点击阅读','Rotate to explore space · Select to read'),x:e.clientX,y:e.clientY});};
 return <points ref={ref} name="interactive-starfield" geometry={data} material={material} onPointerMove={hover} onPointerOut={()=>useAtlas.getState().setHover(null)} onClick={e=>{if(e.delta>4)return;e.stopPropagation();useAtlas.getState().setPanel('sky');}}/>;
}
