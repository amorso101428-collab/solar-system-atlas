import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readNetCDF,decodeGFS} from '../scripts/netcdf.mjs';
import {sampleCloud,parseWeatherGrid,sampleWeather} from '../src/lib/weatherGrid';
const bytes=readFileSync('public/weather/gfs-surface-source.nc'),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),data=decodeGFS(buffer,'fixture');
assert.equal(data.meta.width,1440);assert.equal(data.meta.height,721);assert.equal(data.meta.lat0,-90);assert.equal(data.meta.dLat,.25);assert.equal(data.meta.dLon,.25);assert.equal(data.meta.validTime,data.meta.cloudTime);assert.throws(()=>readNetCDF(buffer.slice(0,50)));assert.throws(()=>decodeGFS(buffer.slice(0,100000),'fixture'));const corrupt=buffer.slice(0);new Uint8Array(corrupt)[0]=0;assert.throws(()=>readNetCDF(corrupt));
const grid=parseWeatherGrid(data.meta,data.values.buffer);grid.clouds=data.clouds;
for(const latitude of [-90,-89.75,0,89.75,90]){const sample=sampleCloud(grid,180,latitude);assert.ok(sample!==null&&sample>=0&&sample<=1);assert.equal(sampleCloud(grid,-180,latitude),sample);assert.deepEqual(sampleWeather(grid,-180,latitude),sampleWeather(grid,180,latitude));}
const nc=readNetCDF(buffer),rawU=nc.array('u-component_of_wind_height_above_ground'),rawR=nc.array('Precipitation_rate_surface'),rawC=nc.array('Total_cloud_cover_entire_atmosphere'),lon=nc.array('longitude'),lat=nc.array('latitude');
const ix=Array.from(lon).findIndex(v=>Math.abs(v-120)<.001),iy=Array.from(lat).findIndex(v=>Math.abs(v-30)<.001),sample=sampleWeather(grid,120,30);
assert.ok(Math.abs(sample[0]-rawU[iy*lon.length+ix])<1e-5);assert.ok(Math.abs(sample[2]-rawR[iy*lon.length+ix]*3600)<1e-4);assert.ok(Math.abs(sampleCloud(grid,120,30)!-rawC[iy*lon.length+ix]/100)<1e-5);
console.log('Native forecast decoding, units, valid time, cloud bounds, poles and dateline passed.');
