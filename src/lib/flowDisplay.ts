/** Visual geometry is specified in CSS pixels, independent of map range. */
export function flowDisplay(width:number,height:number,quality:string,wind:boolean){
 const spacing=quality==='LOW'?62:quality==='MEDIUM'?48:42;
 return {spacing,count:Math.min(wind?650:520,Math.ceil(width/spacing)*Math.ceil(height/spacing)),width:1.05,length:wind?42:36};
}
export function advectFlow(lon:number,lat:number,u:number,v:number,seconds:number,metresPerPixel:number,pixelsPerSecond=20):[number,number]{
 const speed=Math.hypot(u,v);if(speed<.005)return [lon,lat];
 const distance=seconds*pixelsPerSecond*metresPerPixel;
 return [((lon+u/speed*distance/(111319.49*Math.max(.15,Math.cos(lat*Math.PI/180)))+180)%360+360)%360-180,Math.max(-89.5,Math.min(89.5,lat+v/speed*distance/111319.49))];
}
