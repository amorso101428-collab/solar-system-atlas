/** Bound pixel work independently of monitor DPR; restore detail after motion. */
export const shouldRestoreEarthQuality=(now:number,lastMotion:number,gestureActive:boolean)=>!gestureActive&&now-lastMotion>=450;
export function earthRenderBudget(width:number,height:number,dpr:number,quality:string,moving:boolean){
 const density=Math.max(1,dpr||1),pixels=Math.max(1,width*height);
 const budget=moving?(quality==='HIGH'?800000:quality==='MEDIUM'?550000:350000):(quality==='HIGH'?2400000:quality==='MEDIUM'?1800000:800000);
 const cap=moving?.8:quality==='HIGH'?1.2:1;
 return {scale:Math.min(cap,Math.sqrt(budget/pixels))/density,screenError:moving?8:quality==='HIGH'?1.5:quality==='MEDIUM'?3:4};
}
