// Consolidate runtime resources, preserving URLs and original image bytes.
import {cp,mkdir,readFile,writeFile,readdir,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join,relative,sep,extname,resolve} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
const out='dist-pages',limit=4*1024*1024,index={};
if(resolve(out)!==join(process.cwd(),'dist-pages'))throw Error('Invalid generated output');
await rm(out,{recursive:true,force:true});await cp('dist',out,{recursive:true});
const roots=['earth','geo','species','textures','images','data','planets','moons','fonts','credits','current','weather','vendor/cesium/Assets','vendor/cesium/Widgets','vendor/cesium/Workers','vendor/cesium/ThirdParty'];
const types={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.gif':'image/gif','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.wasm':'application/wasm','.xml':'application/xml; charset=utf-8','.md':'text/plain; charset=utf-8','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.bin':'application/octet-stream','.ktx2':'image/ktx2'};
const files=[];async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name);if(e.isDirectory())await walk(path);else files.push(path);}}
await walk(out);files.sort();await mkdir(join(out,'resourcepacks'),{recursive:true});
let chunks=[],size=0,shard=0,tiles=0,compressed=0,savedBytes=0;
const flush=async()=>{if(!chunks.length)return;await writeFile(join(out,'resourcepacks',`resources-${String(shard).padStart(3,'0')}.bin`),Buffer.concat(chunks));chunks=[];size=0;shard++;};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),removed=[];
for(const file of files){
 const path='/'+relative(out,file).split(sep).join('/'),extension=extname(file);
 if(extension==='.map'||path==='/weather/gfs-surface-source.nc'){await rm(file);removed.push(path);continue;}
 if(!types[extension]||!(roots.some(root=>path.startsWith('/'+root+'/'))||path.startsWith('/assets/')&&['.woff','.woff2'].includes(extension)))continue;
 const original=await readFile(file);let bytes=original,encoding;
 if(['.json','.css','.js','.svg','.xml','.md'].includes(extension)){const zipped=gzipSync(original,{level:9});if(zipped.length<original.length){bytes=zipped;encoding='gzip';}}
 if(bytes.length>limit)continue;if(size+bytes.length>limit)await flush();
 const pack=`/resourcepacks/resources-${String(shard).padStart(3,'0')}.bin`;
 index[path]={pack,offset:size,length:bytes.length,originalLength:original.length,hash:digest(original),type:types[extension],...(encoding?{encoding}:{})};
 chunks.push(bytes);size+=bytes.length;if(path.startsWith('/earth/local-tiles/')&&extension==='.jpg')tiles++;if(encoding)compressed++;savedBytes+=original.length-bytes.length;
}
await flush();
const packs=new Map();for(const [path,asset] of Object.entries(index)){
 if(!packs.has(asset.pack))packs.set(asset.pack,await readFile(out+asset.pack));
 let bytes=packs.get(asset.pack).subarray(asset.offset,asset.offset+asset.length);if(asset.encoding==='gzip')bytes=gunzipSync(bytes);
 if(bytes.length!==asset.originalLength||digest(bytes)!==asset.hash)throw Error('Packing mismatch: '+path);
}
// Remove only generated copies after verifying all restored bytes.
for(const path of Object.keys(index))await rm(out+path);
const worker=await readFile('scripts/pages-worker.mjs','utf8');if(!worker.includes('const LOCAL_TILES = {};'))throw Error('Missing resource marker');
await writeFile(out+'/_worker.js',worker.replace('const LOCAL_TILES = {};','const LOCAL_TILES = '+JSON.stringify(index)+';'));
const includes=['/api/*',...roots.map(root=>'/'+root+'/*'),'/assets/*'];
const excludes=files.map(file=>'/'+relative(out,file).split(sep).join('/')).filter(path=>!index[path]&&!removed.includes(path)&&(path.startsWith('/assets/')||path.startsWith('/weather/')));
await writeFile(out+'/_routes.json',JSON.stringify({version:1,include:includes,exclude:excludes},null,2));
let count=0,total=0,max=0;async function measure(dir){for(const e of await readdir(dir,{withFileTypes:true})){const file=join(dir,e.name);if(e.isDirectory())await measure(file);else{const bytes=(await stat(file)).size;count++;total+=bytes;max=Math.max(max,bytes);if(bytes>25*1024*1024)throw Error('Asset too large: '+file);}}}
await measure(out);if(count>1000)throw Error('Dashboard limit exceeded: '+count);
const report={files:count,bytes:total,largestFileBytes:max,packedTiles:tiles,packedResources:Object.keys(index).length,packFiles:shard,gzipResources:compressed,gzipSavedBytes:savedBytes,omittedBuildOnlyFiles:removed,verification:'All decoded resource SHA-256 values match originals; images are lossless'};
await writeFile('pages-build-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
