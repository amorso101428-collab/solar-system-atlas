import type {Engine,EarthConfig} from '../../lib/earthEngine';
export function domesticMapMode(config:EarthConfig){return config.mapSource==='tianditu'&&config.tiandituKey?.trim()?'tianditu':config.mapSource==='local'?'local':config.mapSource==='geoq'?'geoq':'satellite';}
export function createBasemap(C:Engine,config:EarthConfig){
 if(domesticMapMode(config)==='tianditu')return new C.WebMapTileServiceImageryProvider({
  url:'https://t{s}.tianditu.gov.cn/img_c/wmts?tk='+encodeURIComponent(config.tiandituKey!),subdomains:['0','1','2','3','4','5','6','7'],layer:'img',style:'default',format:'tiles',tileMatrixSetID:'c',
  tilingScheme:new C.GeographicTilingScheme(),tileMatrixLabels:Array.from({length:18},(_,i)=>String(i+1)),maximumLevel:17,credit:new C.Credit('天地图 · 国家地理信息公共服务平台')
 });
 return new C.UrlTemplateImageryProvider({url:'/earth/local-tiles/{z}/{y}/{x}.jpg?v=20261003-1',tilingScheme:new C.GeographicTilingScheme(),tileWidth:675,tileHeight:675,minimumLevel:0,maximumLevel:4,credit:new C.Credit('NASA Earth Observatory · Blue Marble / Reto Stöckli · Solar System Scope CC BY 4.0')});
}

/** Satellite photography is the default; the legacy street map stays opt-in. */
export function createHighDetail(C:Engine,source:'geoq'|'satellite'='satellite'){return new C.UrlTemplateImageryProvider({
 url:source==='geoq'?'/api/imagery/geoq-gray/{z}/{y}/{x}.png':'/api/imagery/world-imagery/{z}/{y}/{x}.jpg',tilingScheme:new C.WebMercatorTilingScheme(),tileWidth:256,tileHeight:256,maximumLevel:source==='geoq'?19:18,
 credit:new C.Credit(source==='geoq'?'GeoQ 智图 · 易图通科技（北京）有限公司 · 北京捷泰天域信息技术有限公司':'<a href="https://www.esri.com/">Powered by Esri</a> · World Imagery · Esri, Maxar, Earthstar Geographics, and the GIS User Community')
});}
export function highDetailAlpha(height:number,_quality:string){if(!Number.isFinite(height))return 0;const f=Math.max(0,Math.min(1,(2000000-height)/1800000));return f*f*(3-2*f);}
