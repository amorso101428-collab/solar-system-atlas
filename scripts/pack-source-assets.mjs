// Keep editable application code separate from losslessly packed source assets.
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';

const roots=['public','integrations/solar-system-atlas/public','assets/sources'];
const paths=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else if(entry.isFile())paths.push(path.replaceAll('\\','/'));}}
for(const root of roots)await walk(root);
paths.sort();
const limit=16*1024*1024,output='source-assets';
await mkdir(output,{recursive:true});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let buffers=[],size=0,number=0,originalBytes=0,packedBytes=0;
const files=[],packs=[],seen=new Map();
const packName=()=>`assets-${String(number).padStart(3,'0')}.bin`;
async function flush(){if(!size)return;const bytes=Buffer.concat(buffers);const name=packName();await writeFile(join(output,name),bytes);packs.push({name,bytes:bytes.length,sha256:sha(bytes)});number++;buffers=[];size=0;}
for(const path of paths){
 const original=await readFile(path),hash=sha(original);originalBytes+=original.length;
 let data=seen.get(hash);
 if(!data){
  const zipped=gzipSync(original,{level:9});const bytes=zipped.length<original.length?zipped:original;
  const chunks=[];let cursor=0;
  while(cursor<bytes.length){if(size===limit)await flush();const length=Math.min(limit-size,bytes.length-cursor);chunks.push({pack:packName(),offset:size,length});buffers.push(bytes.subarray(cursor,cursor+length));size+=length;cursor+=length;}
  data={bytes:original.length,sha256:hash,encoding:bytes===zipped?'gzip':'identity',chunks};seen.set(hash,data);packedBytes+=bytes.length;
 }
 files.push({path,...data});
}
await flush();
const manifest={version:1,roots,packs,files,originalBytes,packedBytes};
await writeFile(join(output,'manifest.json'),JSON.stringify(manifest)+'\n');
console.log(JSON.stringify({assets:files.length,uniqueAssets:seen.size,archiveFiles:packs.length+1,originalBytes,packedBytes,lossless:true}));
