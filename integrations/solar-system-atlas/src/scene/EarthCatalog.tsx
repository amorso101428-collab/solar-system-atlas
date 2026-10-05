import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useAtlasStore } from '../state/atlasStore'
import { useExperience } from '../state/experience'
import { getWorld } from '../utils/world'
import { worldNow, smoothYear } from '../utils/clock'
import { liveFrame, liveRecords, liveTracks, missionOrbitIndex, startLiveOrbits, useOrbitStatus, getOrbitStatus, earthFixedFrame, isLiveOrbitMode } from '../astronomy/liveOrbits'

export interface CatalogStats { count:number; generatedAt:string;sourceName:string;scaleNote:string;orbitCounts:Record<string,number> }
const orbitClass=(motion:number)=>motion>11.25?0:motion>.8&&motion<1.2?2:1
let statsRecords:typeof liveRecords | null = null
let statsCache:CatalogStats | null = null
export function getCatalogStats():CatalogStats|null{
  const status=getOrbitStatus();if(!status.count)return null
  if(statsRecords===liveRecords && statsCache)return statsCache
  const orbitCounts={LEO:0,MEO:0,GEO:0}
  for(const r of liveRecords)orbitCounts[(['LEO','MEO','GEO'] as const)[orbitClass(Number(r.MEAN_MOTION))]!]++
  statsRecords=liveRecords
  return statsCache={count:status.count,generatedAt:status.updated,sourceName:status.source,scaleNote:'真实地心位置 / 当前 UTC 推算；显示尺寸经过艺术缩放。',orbitCounts}
}
export function EarthCatalog(){
  const status=useOrbitStatus(),group=useRef<THREE.Group>(null),points=useRef<THREE.Points>(null)
  const gl=useThree(s=>s.gl)
  const uploaded=useRef<object|null>(null)
  useEffect(()=>startLiveOrbits(),[])
  const geometry=useMemo(()=>{
    const geo=new THREE.BufferGeometry(),count=status.count
    geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3))
    geo.setAttribute('aNext',new THREE.BufferAttribute(new Float32Array(count*3),3))
    geo.setAttribute('aValid',new THREE.BufferAttribute(new Float32Array(count),1))
    geo.setAttribute('aClass',new THREE.BufferAttribute(Float32Array.from(liveRecords.map(r=>orbitClass(Number(r.MEAN_MOTION)))),1))
    uploaded.current=null;return geo
  },[status.count])
  const material=useMemo(()=>new THREE.ShaderMaterial({
    uniforms:{uMix:{value:0},uOpacity:{value:0},uDpr:{value:1},uClass:{value:-1}},
    vertexShader:`attribute vec3 aNext;attribute float aValid;attribute float aClass;uniform float uMix;uniform float uOpacity;uniform float uDpr;uniform float uClass;varying float vAlpha;void main(){vec3 p=mix(position,aNext,uMix);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.2*uDpr;vAlpha=aValid*uOpacity*(uClass<0.||abs(uClass-aClass)<.1?1.:.08);}`,
    fragmentShader:`precision highp float;varying float vAlpha;void main(){float a=(1.-smoothstep(.12,.5,length(gl_PointCoord-.5)))*vAlpha;if(a<.005)discard;gl_FragColor=vec4(.77,.80,.77,a);}`,
    transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
  }),[])
  const trackGroup=useMemo(()=>new THREE.Group(),[])
  const trackMaterial=useMemo(()=>new THREE.LineBasicMaterial({color:'#abc0c5',transparent:true,opacity:.15,depthWrite:false}),[])
  useEffect(()=>()=>geometry.dispose(),[geometry])
  useEffect(()=>()=>{material.dispose();trackMaterial.dispose();for(const line of trackGroup.children)(line as THREE.Line).geometry.dispose()},[material,trackMaterial,trackGroup])
  useFrame((_state,delta)=>{
    const earth=getWorld(worldNow()).planets.get('earth'),f=liveFrame,s=useAtlasStore.getState()
    if(!group.current||!earth)return
    group.current.position.copy(earth.position);group.current.quaternion.copy(earthFixedFrame(smoothYear()));group.current.scale.setScalar(earth.planet.radius)
    const ready=!!f && Date.now()-f.time<10000 && isLiveOrbitMode()
    group.current.visible=ready
    if(!f||!ready)return
    if(uploaded.current!==f && geometry.getAttribute('position').count===f.valid.length){
      for(const [name,data] of [['position',f.start],['aNext',f.end],['aValid',f.valid]] as const){const attr=geometry.getAttribute(name) as THREE.BufferAttribute;attr.array.set(data);attr.needsUpdate=true}
      uploaded.current=f
      for(const [index,coords] of liveTracks){
        let line=trackGroup.children.find(c=>c.userData.index===index) as THREE.Line|undefined
        if(!line){line=new THREE.Line(new THREE.BufferGeometry(),trackMaterial);line.userData.index=index;trackGroup.add(line)}
        if(line.userData.coords!==coords){line.geometry.setAttribute('position',new THREE.BufferAttribute(coords,3));line.geometry.computeBoundingSphere();line.userData.coords=coords}
        line.visible=Boolean(f.valid[index])
      }
    }
    material.uniforms.uMix.value=THREE.MathUtils.clamp((Date.now()-f.time)/2000,0,1)
    const show=s.catalogVisible && !s.hideArtificial && !s.hideAllOrbits
    material.uniforms.uOpacity.value=THREE.MathUtils.damp(material.uniforms.uOpacity.value,show?.56:0,7,delta)
    if(points.current)points.current.visible=material.uniforms.uOpacity.value>.002
    material.uniforms.uDpr.value=Math.min(gl.getPixelRatio(),2)
    material.uniforms.uClass.value=s.catalogClass==='ALL'?-1:s.catalogClass==='LEO'?0:s.catalogClass==='MEO'?1:2
    trackGroup.visible=!s.hideArtificial&&!s.hideAllOrbits&&useExperience.getState().context&&((s.focusKind==='PLANET'&&s.focusId==='earth')||(s.focusKind==='OBJECT'&&missionOrbitIndex.has(s.focusId??'')))
  })
  return <group ref={group}><points ref={points} name="earth-catalog-live" geometry={geometry} material={material} frustumCulled={false}/><primitive object={trackGroup}/></group>
}
