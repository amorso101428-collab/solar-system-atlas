import {readFile,writeFile} from 'node:fs/promises';
import {decodeGFS} from './netcdf.mjs';
import {gfsURL,saveWeather} from './environment-feed.mjs';
const url=process.argv[3]||gfsURL(),raw=process.argv[2]?await readFile(process.argv[2]):Buffer.from(await(await fetch(url,{signal:AbortSignal.timeout(900000)})).arrayBuffer());
const data=decodeGFS(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),url);await saveWeather('public',data);await writeFile('public/weather/gfs-surface-source.nc',raw);console.log(data.meta.validTime,data.meta.width,data.meta.height,'clouds',data.meta.cloudTime);
