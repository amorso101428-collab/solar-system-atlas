import type {WeatherGrid} from './weatherGrid';
/** Shared by the legend and the tiled globe raster. Values stay in mm/h;
 * display resampling does not change the source's 0.25-degree resolution. */
export const RAIN_STOPS=[
 [.1,88,167,255],[1,41,207,229],[2.5,59,212,108],[5,248,220,80],
 [10,255,130,62],[20,250,65,94],[30,182,85,236]
] as const;
export function sampleRain(grid:WeatherGrid,lon:number,lat:number){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat<grid.lat0||lat>grid.lat0+grid.dLat*(grid.height-1))return 0;
 const x=(((lon-grid.lon0)/grid.dLon)%grid.width+grid.width)%grid.width,y=Math.max(0,Math.min(grid.height-1,(lat-grid.lat0)/grid.dLat));
 const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;
 const at=(xx:number,yy:number)=>grid.values[(Math.min(grid.height-1,yy)*grid.width+xx%grid.width)*3+2];
 return Math.max(0,(at(x0,y0)*(1-fx)+at(x0+1,y0)*fx)*(1-fy)+(at(x0,y0+1)*(1-fx)+at(x0+1,y0+1)*fx)*fy);
}
/** Contrast comes from clear intensity colors and optical opacity, not a blur
 * or an invented high-resolution forecast. Interpolate the scalar first. */
export function rainRGBA(rate:number,out:Uint8ClampedArray,offset:number){
 if(!Number.isFinite(rate)||rate<=.06){out[offset+3]=0;return;}
 let i=0;while(i<RAIN_STOPS.length-2&&rate>RAIN_STOPS[i+1][0])i++;
 const a=RAIN_STOPS[i],b=RAIN_STOPS[i+1];
 const f=Math.max(0,Math.min(1,(Math.log1p(rate)-Math.log1p(a[0]))/(Math.log1p(b[0])-Math.log1p(a[0]))));
 for(let channel=1;channel<=3;channel++)out[offset+channel-1]=a[channel]+(b[channel]-a[channel])*f;
 const edge=Math.max(0,Math.min(1,(rate-.06)/.1));
 out[offset+3]=(150+85*Math.min(1,Math.log1p(rate)/Math.log(11)))*edge;
}

function cubic(a:number,b:number,c:number,d:number,t:number){
 const t2=t*t,t3=t2*t;
 return (a*(1-3*t+3*t2-t3)+b*(4-6*t2+3*t3)+c*(1+3*t+3*t2-3*t3)+d*t3)/6;
}
/** Positive cubic B-spline display reconstruction. Its 4×4-cell footprint has
 * continuous slopes across cell boundaries and cannot introduce new extrema.
 * This reconstructs the forecast grid, rather than blurring an RGBA image. */
export function sampleRainSmooth(grid:WeatherGrid,lon:number,lat:number){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||lat<grid.lat0||lat>grid.lat0+grid.dLat*(grid.height-1))return 0;
 const x=(((lon-grid.lon0)/grid.dLon)%grid.width+grid.width)%grid.width,y=Math.max(0,Math.min(grid.height-1,(lat-grid.lat0)/grid.dLat)),ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const at=(xx:number,yy:number)=>grid.values[(Math.max(0,Math.min(grid.height-1,yy))*grid.width+(xx+grid.width)%grid.width)*3+2];
 const row=(yy:number)=>cubic(at(ix-1,yy),at(ix,yy),at(ix+1,yy),at(ix+2,yy),fx);
 return Math.max(0,cubic(row(iy-1),row(iy),row(iy+1),row(iy+2),fy));
}
