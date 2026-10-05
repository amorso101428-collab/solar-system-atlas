import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseWeatherGrid} from '../src/lib/weatherGrid';
import {READING} from '../src/data/reading';
const digest=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
for(const name of ['earth_daymap-4k.jpg','earth_clouds-4k.jpg','earth_nightmap-2k.jpg'])assert.equal(digest('public/earth/solar-'+name),digest('integrations/solar-system-atlas/public/planets/'+name));
const meta=JSON.parse(readFileSync('public/weather/gfs-surface.json','utf8')),bytes=readFileSync('public'+meta.binary);
const grid=parseWeatherGrid(meta,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
assert.ok(Date.parse(grid.validTime));assert.equal(grid.width*grid.dLon,360);assert.equal(grid.lon0,-180);assert.equal(grid.lat0,-90);assert.equal(grid.lat0+(grid.height-1)*grid.dLat,90);assert.equal(grid.dLon,.25);assert.equal(grid.dLat,.25);
for(let i=0;i<grid.values.length;i+=3){assert.ok(Math.hypot(grid.values[i],grid.values[i+1])<150);assert.ok(grid.values[i+2]>=0&&grid.values[i+2]<1000);}
assert.ok(existsSync('public/weather/gfs-surface-source.nc'));
const cloudBytes=readFileSync('public'+meta.cloudBinary);assert.equal(cloudBytes.byteLength,grid.width*grid.height*4);const clouds=new Float32Array(cloudBytes.buffer.slice(cloudBytes.byteOffset,cloudBytes.byteOffset+cloudBytes.byteLength));assert.ok(clouds.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(clouds.some(v=>v>.8)&&clouds.some(v=>v<.1));
for(const chapters of Object.values(READING))for(const c of chapters){assert.ok(c.title.en&&c.title['zh-CN']);assert.ok(c.paragraphs.every(p=>p.en&&!/[\u4e00-\u9fff]/.test(p.en)&&p['zh-CN']));}
console.log('Shared Earth asset identity, packaged forecast integrity and bilingual reading passed.');
