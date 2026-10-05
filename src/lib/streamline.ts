export type FlowPoint={x:number;y:number;distance:number};
export type VectorSample=(lon:number,lat:number)=>readonly number[];
export function wrappedLon(lon:number){return ((lon+180)%360+360)%360-180;}
/** Midpoint integration in the local east/north basis, not in screen axes. */
export function flowStep(lon:number,lat:number,metres:number,sample:VectorSample):[number,number]{
 const a=sample(lon,lat),speed=Math.hypot(a[0],a[1]);if(speed<.01)return [lon,lat];
 const east=metres*a[0]/speed,north=metres*a[1]/speed;
 const halfLat=Math.max(-88.5,Math.min(88.5,lat+north/222638.98));
 const halfLon=wrappedLon(lon+east/(222638.98*Math.max(.06,Math.cos(lat*Math.PI/180))));
 const b=sample(halfLon,halfLat),s=Math.hypot(b[0],b[1]);if(s<.01)return [lon,lat];
 return [wrappedLon(lon+metres*b[0]/s/(111319.49*Math.max(.06,Math.cos(halfLat*Math.PI/180)))),Math.max(-88.5,Math.min(88.5,lat+metres*b[1]/s/111319.49))];
}
/** Fades only at path ends; there is no frame-to-frame collision visibility. */
export function flowEnvelope(distance:number,length:number){const edge=Math.min(distance,length-distance);return Math.max(0,Math.min(1,edge/18));}
export function flowBudget(width:number,height:number,quality:string,wind:boolean){
 const mobile=width<700||Math.min(width,height)<500,spacing=quality==='LOW'?40:quality==='MEDIUM'?34:30;
 return {spacing,count:Math.min(mobile?380:quality==='HIGH'?1000:quality==='MEDIUM'?760:480,Math.ceil(width/spacing)*Math.ceil(height/spacing)),width:wind?1.05:1.2,length:wind?140:180,fps:mobile||quality==='LOW'?24:30};
}
