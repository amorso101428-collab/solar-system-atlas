import {createReadStream} from 'node:fs';
import {extname} from 'node:path';
const types={'.mp3':'audio/mpeg','.m4a':'audio/mp4','.flac':'audio/flac','.ogg':'audio/ogg','.wav':'audio/wav'};
/** Serve music in byte ranges; playback need not download the entire song first. */
export function serveAudio(req,res,file,stat,etag){
 const type=types[extname(file)];if(!type)return false;
 const headers={'content-type':type,'accept-ranges':'bytes','cache-control':'public, max-age=86400',etag};
 let start=0,end=stat.size-1,status=200;
 if(req.headers.range){
  const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
  if(match&&(match[1]||match[2])){
   if(match[1]){start=Number(match[1]);end=match[2]?Math.min(end,Number(match[2])):end;}
   else start=Math.max(0,stat.size-Number(match[2]));
  }
  if(!match||!(match[1]||match[2])||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=stat.size){res.writeHead(416,{...headers,'content-range':`bytes */${stat.size}`});res.end();return true;}
  status=206;headers['content-range']=`bytes ${start}-${end}/${stat.size}`;
 }
 res.writeHead(status,{...headers,'content-length':end-start+1});
 if(req.method==='HEAD'){res.end();return true;}
 const stream=createReadStream(file,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res);return true;
}
