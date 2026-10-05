/** Named routes are schematic. Clip every half-degree sample to the same
 * ocean mask as the animated field. Cartesian polylines cross ±180°
 * continuously; only actual land breaks a route. */
export function oceanRouteSegments(path:readonly (readonly number[])[],isOcean:(lon:number,lat:number)=>boolean,minPoints=2){
 const segments:number[][][]=[];let segment:number[][]=[];
 const finish=()=>{if(segment.length>=minPoints)segments.push(segment);segment=[];};
 for(let i=0;i<path.length-1;i++){
  const a=path[i],b=path[i+1],delta=((b[0]-a[0]+540)%360)-180,steps=Math.max(1,Math.ceil(Math.max(Math.abs(delta),Math.abs(b[1]-a[1]))*2));
  for(let j=0;j<=steps;j++){const f=j/steps,lon=((a[0]+delta*f+540)%360)-180,lat=a[1]+(b[1]-a[1])*f;
   if(!isOcean(lon,lat)){finish();continue;}
   const previous=segment[segment.length-1];if(!previous||previous[0]!==lon||previous[1]!==lat)segment.push([lon,lat]);
  }
 }
 finish();return segments;
}
