// A bounded reader for classic NetCDF single-time geographic subsets, no native addons.
export function readNetCDF(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);let p=4;
 if(bytes[0]!==67||bytes[1]!==68||bytes[2]!==70||![1,2].includes(bytes[3]))throw Error('Expected classic NetCDF');
 const need=n=>{if(p+n>bytes.length)throw Error('Truncated NetCDF header');};
 const uint=()=>{need(4);const n=view.getUint32(p);p+=4;return n;};
 const text=()=>{const n=uint();need(n);const s=new TextDecoder().decode(bytes.subarray(p,p+n));p+=Math.ceil(n/4)*4;return s;};
 const records=uint(),sizes={1:1,2:1,3:2,4:4,5:4,6:8};
 const number=(type,offset)=>{if(offset+(sizes[type]||Infinity)>bytes.length)throw Error('Truncated NetCDF data');return type===1?view.getInt8(offset):type===3?view.getInt16(offset):type===4?view.getInt32(offset):type===5?view.getFloat32(offset):type===6?view.getFloat64(offset):bytes[offset];};
 const attributes=()=>{const tag=uint(),n=uint();if((tag!==12&&!(tag===0&&n===0))||n>10000)throw Error('Invalid NetCDF attributes');const a={};for(let i=0;i<n;i++){const name=text(),type=uint(),count=uint(),size=sizes[type];if(!size||count>1000000)throw Error('Invalid attribute');need(count*size);a[name]=type===2?new TextDecoder().decode(bytes.subarray(p,p+count)):Array.from({length:count},(_,j)=>number(type,p+j*size));p+=Math.ceil(count*size/4)*4;}return a;};
 const dimTag=uint(),dimCount=uint();if(dimTag!==10||dimCount>100)throw Error('Invalid dimensions');const dimensions=Array.from({length:dimCount},()=>({name:text(),size:uint()}));attributes();
 const varTag=uint(),varCount=uint();if(varTag!==11||varCount>1000)throw Error('Invalid variables');const vars={};
 for(let i=0;i<varCount;i++){const name=text(),rank=uint();if(rank>10)throw Error('Invalid rank');const ids=Array.from({length:rank},uint);if(ids.some(id=>!dimensions[id]))throw Error('Invalid dimension');const attrs=attributes(),type=uint(),vsize=uint();let offset=uint();if(bytes[3]===2)offset=offset*4294967296+uint();vars[name]={name,type,attrs,ids,shape:ids.map(id=>dimensions[id].size||records),offset,vsize};}
 const array=name=>{const v=vars[name];if(!v||!sizes[v.type])throw Error('Missing variable '+name);if(v.ids.some(id=>dimensions[id].size===0)&&records!==1)throw Error('Only single-time record subsets supported');const count=v.shape.reduce((a,b)=>a*b,1);if(count>20000000||v.offset+count*sizes[v.type]>bytes.length)throw Error('Truncated or oversized variable');const scale=v.attrs.scale_factor?.[0]??1,add=v.attrs.add_offset?.[0]??0,missing=[v.attrs._FillValue?.[0],v.attrs.missing_value?.[0]];const out=new Float64Array(count);for(let i=0;i<count;i++){const n=number(v.type,v.offset+i*sizes[v.type]);out[i]=missing.includes(n)?NaN:n*scale+add;}return out;};
 return {vars,dimensions,array};
}
export function decodeGFS(buffer,url){
 const nc=readNetCDF(buffer),lon=nc.array('longitude'),lat=nc.array('latitude');
 const sorted=Array.from(lon,(v,i)=>({v:((v+180)%360+360)%360-180,i})).sort((a,b)=>a.v-b.v).filter((v,i,a)=>i===0||v.v-a[i-1].v>1e-5),rows=Array.from(lat,(v,i)=>({v,i})).sort((a,b)=>a.v-b.v);
 const width=sorted.length,height=rows.length,dLon=sorted[1].v-sorted[0].v,dLat=rows[1].v-rows[0].v;
 if(width<2||height<2||width>2000||height>1000||Math.abs(width*dLon-360)>.001||dLon>.25001||dLat>.25001)throw Error('Expected full 0.25-degree GFS grid');
 for(let i=1;i<width;i++)if(Math.abs(sorted[i].v-sorted[i-1].v-dLon)>.001)throw Error('Irregular longitude');
 for(let i=1;i<height;i++)if(Math.abs(rows[i].v-rows[i-1].v-dLat)>.001)throw Error('Irregular latitude');
 const names=['u-component_of_wind_height_above_ground','v-component_of_wind_height_above_ground','Precipitation_rate_surface','Total_cloud_cover_entire_atmosphere'],channels=names.map(n=>{const v=nc.vars[n];if(!v||v.shape.reduce((a,b)=>a*b,1)!==lon.length*lat.length)throw Error('Expected one time and height per variable');return nc.array(n);});
 const times=names.map(name=>{const variable=nc.vars[name],timeDim=variable.ids.find(id=>nc.dimensions[id].name.startsWith('time'));const time=nc.vars[nc.dimensions[timeDim]?.name];if(!time||typeof time.attrs.units!=='string')throw Error('Missing CF time');const match=time.attrs.units.match(/^(hours?|seconds?|days?) since (.+)$/i);if(!match)throw Error('Unsupported CF time');const epoch=Date.parse(match[2].replace(' UTC','Z')),value=nc.array(time.name)[0]*(match[1].toLowerCase().startsWith('hour')?3600000:match[1].toLowerCase().startsWith('day')?86400000:1000),valid=epoch+value;if(!Number.isFinite(valid))throw Error('Invalid valid time');return new Date(valid).toISOString();});
 const values=new Float32Array(width*height*3),clouds=new Float32Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const src=rows[y].i*lon.length+sorted[x].i,k=y*width+x;for(let c=0;c<4;c++){const v=channels[c][src]*(c===2?3600:c===3?.01:1);if(!Number.isFinite(v)||(c<2&&Math.abs(v)>150)||(c===2&&(v<0||v>1000))||(c===3&&(v<0||v>1.001)))throw Error('Missing or invalid GFS values');if(c===3)clouds[k]=Math.min(1,v);else values[k*3+c]=v;}}
 const meta={source:'NOAA / NCEP GFS via NSF Unidata NCSS',url,validTime:times[0],rainTime:times[2],cloudTime:times[3],downloadedAt:new Date().toISOString(),width,height,lon0:sorted[0].v,lat0:rows[0].v,dLon,dLat,channels:['eastward wind m/s','northward wind m/s','precipitation rate mm/h'],nativeResolution:'0.25°',displayResolution:'0.25°',binary:'/weather/gfs-surface.bin',cloudBinary:'/weather/gfs-clouds.bin',license:'US government data; served by NSF Unidata'};
 return {meta,values,clouds};
}
