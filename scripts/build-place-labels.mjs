// Rebuild local names from Natural Earth's public-domain, multilingual data.
// Optional arguments point to downloaded GeoJSON files for an offline rebuild.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {Converter} from 'opencc-js';
const convert=Converter({from:'tw',to:'cn'});
const base='https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
async function dataset(name,path){
 if(path)return JSON.parse(await readFile(path,'utf8'));
 const r=await fetch(base+name+'.geojson');if(!r.ok)throw Error(`Cannot download ${name}: ${r.status}`);return r.json();
}
const countries=(await dataset('ne_10m_admin_0_countries',process.argv[2])).features.map(({properties:p})=>({id:'country:'+p.ADM0_A3,kind:'country',cn:p.ADM0_A3==='TWN'?'台湾':convert(p.NAME_ZH||p.NAME_EN||p.NAME),en:p.ADM0_A3==='TWN'?'Taiwan':p.NAME_EN||p.NAME,lon:p.LABEL_X,lat:p.LABEL_Y,rank:p.LABELRANK||4,minZoom:3})).filter(p=>Number.isFinite(p.lon+p.lat));
const cities=(await dataset('ne_10m_populated_places',process.argv[3])).features.map(({properties:p})=>({id:'city:'+p.NE_ID,kind:'city',cn:convert(p.NAME_ZH||p.NAME),en:p.NAME_EN||p.NAME,lon:p.LONGITUDE,lat:p.LATITUDE,rank:p.SCALERANK,minZoom:Math.max(5,p.MIN_ZOOM),population:p.POP_MAX})).filter(p=>Number.isFinite(p.lon+p.lat));
const out=new URL('../public/geo/',import.meta.url);await mkdir(out,{recursive:true});
for(const [name,data] of [['country-labels',countries],['major-city-labels',cities.filter(p=>p.rank<=3)],['city-labels',cities]])await writeFile(new URL(name+'.json',out),JSON.stringify(data));
console.log(`Saved ${countries.length} countries/regions and ${cities.length} cities.`);
