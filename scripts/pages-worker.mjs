// Cloudflare Pages adapter for the existing fixed-origin data services.
const DETAIL_ORIGIN='https://thematic.geoq.cn/arcgis/rest/services/ChinaOnlineStreetGray/MapServer/tile';
const SATELLITE_ORIGIN='https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
const LOCAL_TILES = {};
function unavailable(message,status=503){return new Response(message,{status,headers:{'cache-control':'no-store','retry-after':'30','x-content-type-options':'nosniff'}});}
export function detailTilePath(path){const m=/^\/api\/imagery\/(geoq-gray|world-imagery)\/(\d+)\/(\d+)\/(\d+)\.(png|jpg)$/.exec(path);if(!m||m[5]!== (m[1]==='geoq-gray'?'png':'jpg'))return null;const [z,y,x]=m.slice(2,5).map(Number);return z<=(m[1]==='geoq-gray'?19:18)&&x<2**z&&y<2**z?{z,y,x}:null;}
export default {
 async fetch(request,env,ctx){
  const url=new URL(request.url);
  if(LOCAL_TILES[url.pathname] || url.pathname.startsWith('/earth/local-tiles/') && Object.keys(LOCAL_TILES).length){
   if(!['GET','HEAD'].includes(request.method))return unavailable('Method not allowed',405);
   const tile=LOCAL_TILES[url.pathname];
   if(!tile)return unavailable('Tile not found',404);
   const key=new Request(url.origin+url.pathname+'?pack='+tile.hash);
   const cached=await caches.default.match(key);if(cached)return request.method==='HEAD'?new Response(null,{headers:cached.headers}):cached;
   try{
    const pack=await env.ASSETS.fetch(new Request(new URL(tile.pack,url.origin),{headers:{Range:`bytes=${tile.offset}-${tile.offset+tile.length-1}`}}));
    if(!pack.ok)throw Error('Missing tile pack');
    const raw=await pack.arrayBuffer();
    let bytes=pack.status===206?raw:raw.slice(tile.offset,tile.offset+tile.length);
    if(bytes.byteLength!==tile.length)throw Error('Invalid tile range');
    if(tile.encoding==='gzip')bytes=await new Response(new Response(bytes).body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if(bytes.byteLength!==(tile.originalLength||tile.length))throw Error('Invalid decoded asset');
    const response=new Response(bytes,{headers:{'content-type':tile.type||'image/jpeg','content-length':String(bytes.byteLength),'cache-control':'public, max-age=86400','etag':'"'+tile.hash+'"','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'}});
    ctx.waitUntil(caches.default.put(key,response.clone()));
    return request.method==='HEAD'?new Response(null,{headers:response.headers}):response;
   }catch{return unavailable('Saved imagery temporarily unavailable');}
  }
  if(url.pathname.startsWith('/api/')){
   if(!['GET','HEAD'].includes(request.method))return unavailable('Method not allowed',405);
   if(url.pathname.startsWith('/api/imagery/')){
    const tile=detailTilePath(url.pathname);if(!tile)return unavailable('Invalid tile',400);
    const key=new Request(url.origin+url.pathname);
    const cached=await caches.default.match(key);if(cached)return cached;
    try{
     const satellite=url.pathname.includes('/world-imagery/');
     const upstream=await fetch(`${satellite?SATELLITE_ORIGIN:DETAIL_ORIGIN}/${tile.z}/${tile.y}/${tile.x}`,{signal:AbortSignal.timeout(12000)});
     if(!upstream.ok)return unavailable('Detail imagery unavailable; retain local basemap');
     const bytes=new Uint8Array(await upstream.arrayBuffer());
     const valid=satellite?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v);
     if(bytes.length>2*1024*1024||!valid)return unavailable('Invalid imagery response');
     const response=new Response(bytes,{headers:{'content-type':satellite?'image/jpeg':'image/png','cache-control':'public, max-age=86400','x-imagery-source':satellite?'Esri World Imagery; satellite and aerial photography':'GeoQ ChinaOnlineStreetGray; domestic street basemap','x-content-type-options':'nosniff'}});
     ctx.waitUntil(caches.default.put(key,response.clone()));return response;
    }catch{return unavailable('Detail imagery unavailable; retain local basemap');}
   }
   if(url.pathname==='/api/orbits'){
    const key=new Request(url.origin+'/api/orbits');const cached=await caches.default.match(key);if(cached)return cached;
    try{
     const upstream=await fetch('https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json',{signal:AbortSignal.timeout(12000)});
     if(!upstream.ok)return unavailable('Orbit service unavailable');
     const text=await upstream.text();if(text.length>16*1024*1024)return unavailable('Orbit response too large');
     const data=JSON.parse(text);if(!Array.isArray(data)||!data.length||!data.every(r=>r.NORAD_CAT_ID&&r.EPOCH))return unavailable('Invalid orbit response');
     const response=new Response(text,{headers:{'content-type':'application/json','cache-control':'public, max-age=7200','x-orbit-fetched-at':new Date().toISOString(),'x-content-type-options':'nosniff'}});
     ctx.waitUntil(caches.default.put(key,response.clone()));return response;
    }catch{return unavailable('Orbit service unavailable');}
   }
   // Global GFS grids use the saved, date-labelled snapshot on static hosting.
   // The application already falls back to /weather/gfs-surface.json.
   return unavailable('Live endpoint unavailable on this host; use saved snapshot',404);
  }
  return env.ASSETS.fetch(request);
 }
};
