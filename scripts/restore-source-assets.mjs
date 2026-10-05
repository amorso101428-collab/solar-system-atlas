import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {dirname,isAbsolute,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../',import.meta.url));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const allowed=['public/','integrations/solar-system-atlas/public/','assets/sources/'];
export async function restoreSourceAssets({targetRoot=project,verifyOnly=false}={}){
 const manifest=JSON.parse(await readFile(resolve(project,'source-assets/manifest.json'),'utf8'));
 if(manifest.version!==1||!Array.isArray(manifest.files)||!Array.isArray(manifest.packs))throw Error('Invalid source asset manifest');
 const packs=new Map();
 for(const item of manifest.packs){
  if(!/^assets-\d{3}\.bin$/.test(item.name))throw Error('Invalid source asset pack name');
  const bytes=await readFile(resolve(project,'source-assets',item.name));
  if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw Error(`Source asset pack checksum mismatch: ${item.name}`);
  packs.set(item.name,bytes);
 }
 const root=resolve(targetRoot);let restored=0;
 for(const item of manifest.files){
  if(typeof item.path!=='string'||isAbsolute(item.path)||item.path.includes('\\')||item.path.split('/').some(part=>part==='..'||part==='')||!allowed.some(prefix=>item.path.startsWith(prefix)))throw Error('Invalid source asset path');
  const target=resolve(root,item.path);
  if(!target.startsWith(root+sep))throw Error('Source asset path escapes destination');
  const chunks=item.chunks.map(chunk=>{const pack=packs.get(chunk.pack);if(!pack||!Number.isInteger(chunk.offset)||!Number.isInteger(chunk.length)||chunk.offset<0||chunk.length<0||chunk.offset+chunk.length>pack.length)throw Error(`Invalid chunk: ${item.path}`);return pack.subarray(chunk.offset,chunk.offset+chunk.length);});
  let bytes=Buffer.concat(chunks);if(item.encoding==='gzip')bytes=gunzipSync(bytes);else if(item.encoding!=='identity')throw Error('Invalid asset encoding');
  if(bytes.length!==item.bytes||sha(bytes)!==item.sha256)throw Error(`Source asset checksum mismatch: ${item.path}`);
  if(verifyOnly)continue;
  let existing;try{existing=await readFile(target);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(existing){if(sha(existing)!==item.sha256)throw Error(`Locally edited asset retained: ${item.path}. Run npm run pack:assets to update its package.`);continue;}
  await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);restored++;
 }
 return {assets:manifest.files.length,archiveFiles:manifest.packs.length+1,restored,verified:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const at=process.argv.indexOf('--target');
 console.log(JSON.stringify(await restoreSourceAssets({verifyOnly:process.argv.includes('--verify'),...(at>=0?{targetRoot:process.argv[at+1]}:{})})));
}
