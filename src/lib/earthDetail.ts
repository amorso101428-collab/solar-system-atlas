// Avoid competing with imagery downloads in views where relief is subpixel.
export function needsTerrain(height:number,active:boolean,enabled:boolean,moving:boolean){
 if(!enabled||!Number.isFinite(height))return false;
 return active ? height<1800000 : height<1200000&&!moving;
}
export function detailError(quality:string,moving:boolean){return moving?8:quality==='HIGH'?1:quality==='MEDIUM'?2.5:4;}
export function needsScienceRaster(layers:Record<string,boolean>){
 return ['wind','rain','cloudcover','field','warmcold'].some(k=>layers[k]) || !layers.land || !layers.ocean;
}

/** Use one continuous solar photograph for orbital views. Streaming mosaic
 * tiles replace it gradually at regional scales, rather than patch by patch
 * across the entire visible hemisphere. Also saves orbital tile requests. */
export function imageryDetailAlpha(height:number){
 if(!Number.isFinite(height))return 0;
 const f=Math.max(0,Math.min(1,(6000000-height)/3000000));
 return f*f*(3-2*f);
}
