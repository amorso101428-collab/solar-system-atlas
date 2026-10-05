import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { oceanArrival } from '../ui/OceanGateway'
/** Preserve the viewed hemisphere without a camera flight or navigation delay. */
export function OceanDive(){
 const {camera,scene}=useThree()
 useEffect(()=>{
  const direction=new THREE.Vector3()
  const capture=()=>{
   const mesh=scene.getObjectByName('planet:earth');if(!mesh)return
   direction.copy(camera.position);mesh.worldToLocal(direction).normalize()
   oceanArrival.lon=THREE.MathUtils.radToDeg(Math.atan2(direction.z,-direction.x))-180
   oceanArrival.lat=THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(direction.y,-1,1)))
  }
  window.addEventListener('atlas-ocean-coordinates',capture)
  return()=>window.removeEventListener('atlas-ocean-coordinates',capture)
 },[camera,scene])
 return null
}
