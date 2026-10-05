export type UIMotion = 'auto' | 'full' | 'reduced';
export function parseUIMotion(value: string | null): UIMotion {
 return value === 'full' || value === 'reduced' ? value : 'auto';
}
export function initialMotion(): UIMotion {
 if(typeof window==='undefined')return 'auto';
 const query=new URLSearchParams(window.location.search).get('motion');
 if(query!==null)return parseUIMotion(query);
 try {
  const saved=sessionStorage.getItem('atlas.uiMotion');
  if(saved!==null)return parseUIMotion(saved);
  return parseUIMotion(JSON.parse(sessionStorage.getItem('atlas.solarReturn')||'{}').motion??null);
 }catch{return 'auto';}
}
export function nextMotion(current:UIMotion):UIMotion {
 const mode=current==='auto'?'full':current==='full'?'reduced':'auto';
 try{sessionStorage.setItem('atlas.uiMotion',mode);}catch{/* Optional storage. */}
 return mode;
}
