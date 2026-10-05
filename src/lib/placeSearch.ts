import {FEATURE_LABELS,GLOBAL_LABELS,normalizePlaceLabel,type PlaceLabel} from './geographicLabels';
let names:Promise<PlaceLabel[]>|null=null;
export function findPlaces(data:PlaceLabel[],query:string){
 const q=query.trim().toLocaleLowerCase();if(!q)return [];
 return data.map(normalizePlaceLabel).filter(p=>(p.cn+' '+p.en).toLocaleLowerCase().includes(q)).sort((a,b)=>{
  const exact=(p:PlaceLabel)=>p.cn.toLocaleLowerCase()===q||p.en.toLocaleLowerCase()===q?1:0;
  return exact(b)-exact(a)||(b.population||0)-(a.population||0)||a.rank-b.rank;
 }).slice(0,10).map(p=>({cn:p.cn,en:p.en,lon:p.lon,lat:p.lat,range:p.kind==='country'?2400000:p.kind==='continent'?12000000:p.kind==='ocean'?8000000:p.kind==='city'?80000:350000}));
}
export async function searchSavedPlaces(query:string){
 if(!names)names=Promise.all(['country-labels','city-labels'].map(async name=>{const r=await fetch('/geo/'+name+'.json');if(!r.ok)throw Error('Saved search unavailable');return r.json() as Promise<PlaceLabel[]>;})).then(data=>[...GLOBAL_LABELS,...FEATURE_LABELS,...data.flat()]).catch(e=>{names=null;throw e;});
 return findPlaces(await names,query);
}
