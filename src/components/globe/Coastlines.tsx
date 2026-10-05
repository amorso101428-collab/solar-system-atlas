import {useEffect,useState} from 'react';
import * as THREE from 'three';
import {loadLand,eachRing,lonLatToVec3} from '../../lib/geo';
export default function Coastlines(){
 const [geometry,setGeometry]=useState<THREE.BufferGeometry|null>(null);
 useEffect(()=>{let cancelled=false,mesh:THREE.BufferGeometry|undefined;loadLand().then(features=>{if(cancelled)return;const vertices:number[]=[];for(const f of features)eachRing(f.geometry,ring=>{for(let i=1;i<ring.length;i++){const a=new THREE.Vector3(...lonLatToVec3(ring[i-1][0],ring[i-1][1],1)),b=new THREE.Vector3(...lonLatToVec3(ring[i][0],ring[i][1],1));const steps=Math.max(1,Math.ceil(a.angleTo(b)/(.02)));for(let j=0;j<steps;j++){vertices.push(...a.clone().lerp(b,j/steps).normalize().multiplyScalar(1.0003).toArray(),...a.clone().lerp(b,(j+1)/steps).normalize().multiplyScalar(1.0003).toArray());}}});mesh=new THREE.BufferGeometry();mesh.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));setGeometry(mesh);}).catch(()=>{});return()=>{cancelled=true;mesh?.dispose();};},[]);
 return geometry?<lineSegments geometry={geometry} raycast={()=>null}><lineBasicMaterial color="#d9c6a3" transparent opacity={.65} depthWrite={false}/></lineSegments>:null;
}
