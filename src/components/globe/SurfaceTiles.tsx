import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lonLatToVec3 } from "../../lib/geo";
import { useImagery } from "../../lib/imagery";
import { sphereHitToLonLat } from "../../lib/pick";

export function tileFor(lon:number,lat:number,z:number){const n=2**z;return {x:Math.floor((lon+180)/360*n)%n,y:Math.min(n-1,Math.max(0,Math.floor((1-Math.asinh(Math.tan(Math.max(-85.05,Math.min(85.05,lat))*Math.PI/180))/Math.PI)/2*n)))};}
function patch(x:number,y:number,z:number){
 const n=2**z,segments=24,positions:number[]=[],uvs:number[]=[],indices:number[]=[];
 for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
  const u=i/segments,v=j/segments,lon=(x+u)/n*360-180,lat=Math.atan(Math.sinh(Math.PI*(1-2*(y+v)/n)))*180/Math.PI;
  positions.push(...lonLatToVec3(lon,lat,1.000001));uvs.push(u,1-v);
 }
 for(let j=0;j<segments;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
function Tile({x,y,z,revision}:{x:number;y:number;z:number;revision:number}){
 const geometry=useMemo(()=>patch(x,y,z),[x,y,z]);const [texture,setTexture]=useState<THREE.Texture|null>(null);
 useEffect(()=>{let alive=true;let loaded:THREE.Texture|undefined;const loader=new THREE.TextureLoader();loader.setCrossOrigin("anonymous");
  loaded=loader.load(`/api/imagery/geoq-gray/${z}/${y}/${x}.png`,tex=>{if(!alive){tex.dispose();return;}tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;setTexture(tex);useImagery.getState().finish(revision,true);},undefined,()=>{if(alive){setTexture(null);useImagery.getState().finish(revision,false);}});
  return()=>{alive=false;loaded?.dispose();};
 },[x,y,z,revision]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return texture?<mesh geometry={geometry} raycast={()=>null}><meshBasicMaterial map={texture} toneMapped={false} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/></mesh>:null;
}
/** Bounded streaming: at most 25 visible-area tiles, no bulk downloads or offline caching. */
export default function SurfaceTiles(){
 const revision=useImagery(s=>s.revision);
 const [keys,setKeys]=useState<{x:number;y:number;z:number}[]>([]),last=useRef(""),elapsed=useRef(0);
 useFrame(({camera},dt)=>{elapsed.current+=dt;if(elapsed.current<.3)return;elapsed.current=0;
  const h=camera.position.length()-1;if(h>.85){if(last.current){setKeys([]);last.current="";useImagery.getState().hide();}return;}
  const [lon,lat]=sphereHitToLonLat(camera.position.clone().normalize(),1),z=Math.min(17,Math.max(3,Math.floor(Math.log2(1/Math.max(h,.000015)))+3));
  const {x,y}=tileFor(lon,lat,z),key=`${z}/${x}/${y}`;if(last.current===`${key}:${useImagery.getState().revision}`)return;last.current=key;
  const n=2**z,next=[];for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const yy=y+dy;if(yy>=0&&yy<n)next.push({x:(x+dx+n)%n,y:yy,z});}const rev=useImagery.getState().begin(z,next.length);last.current=`${key}:${rev}`;setKeys(next);
 });
 return <group>{keys.map(k=><Tile key={`${revision}/${k.z}/${k.x}/${k.y}`} revision={revision} {...k}/>)}</group>;
}
