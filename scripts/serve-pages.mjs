// Local preview of the actual Pages worker and packed assets. Loopback only.
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=resolve(process.argv[2]||'dist-pages'),port=Number(process.argv[3]||4192);
const worker=(await import(pathToFileURL(resolve(root,'_worker.js')).href)).default;
const cache=new Map(),packs=new Map();
globalThis.caches={default:{match:async key=>cache.get(key.url)?.clone(),put:async(key,value)=>{cache.set(key.url,value);if(cache.size>256)cache.delete(cache.keys().next().value);}}};
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.mp3':'audio/mpeg','.m4a':'audio/mp4'};
const env={ASSETS:{fetch:async request=>{
 let path=decodeURIComponent(new URL(request.url).pathname);if(path.endsWith('/'))path+='index.html';
 let file=resolve(root,'.'+path);if(!file.startsWith(root+sep))return new Response('Forbidden',{status:403});
 let info=await stat(file).catch(()=>null);
 if(!info?.isFile()&&!extname(path)){file=resolve(root,path.startsWith('/solar')?'solar/index.html':'index.html');info=await stat(file).catch(()=>null);}
 if(!info?.isFile())return new Response('Not found',{status:404});
 let bytes=packs.get(file);if(!bytes){bytes=await readFile(file);if(path.startsWith('/resourcepacks/')){packs.set(file,bytes);if(packs.size>16)packs.delete(packs.keys().next().value);}}
 const versioned=/-[A-Z0-9]{8}\./.test(file)||path.startsWith('/resourcepacks/');
 const headers={'content-type':types[extname(file)]||'application/octet-stream','accept-ranges':'bytes','cache-control':versioned?'public, max-age=3600':'no-cache'};
 const range=/^bytes=(\d+)-(\d*)$/.exec(request.headers.get('range')||'');
 if(range){const start=Number(range[1]),end=Math.min(info.size-1,range[2]?Number(range[2]):info.size-1);if(start>end)return new Response(null,{status:416});headers['content-range']=`bytes ${start}-${end}/${info.size}`;headers['content-length']=String(end-start+1);return new Response(request.method==='HEAD'?null:bytes.subarray(start,end+1),{status:206,headers});}
 headers['content-length']=String(bytes.length);return new Response(request.method==='HEAD'?null:bytes,{headers});
}}};
createServer(async(req,res)=>{try{
 const request=new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers});
 const pending=[],response=await worker.fetch(request,env,{waitUntil:p=>pending.push(p.catch(()=>{}))});
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));await Promise.all(pending);
}catch(error){res.writeHead(500);res.end(String(error));}}).listen(port,'127.0.0.1',()=>console.log(`Packed Pages preview: http://127.0.0.1:${port}`));
