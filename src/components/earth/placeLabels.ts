import type * as Cesium from 'cesium';
import type {Engine} from '../../lib/earthEngine';
import {oceanRouteSegments} from '../../lib/oceanRouteSegments';
import {isWater,type CurrentField} from '../../lib/currentField';
import {CURRENTS} from '../../data/currents';
import {windLabels} from '../../data/winds';
import {isDenmark} from '../../lib/musicEasterEggs';
import {useAtlas} from '../../state/store';
import {useEarthView} from '../../lib/earthEngine';
import {GLOBAL_LABELS,FEATURE_LABELS,labelZoom,labelText,hasEnglishLabel,labelCategory,eligibleLabel,labelOpacity,labelFontSize,labelBudget,inGeographicBounds,boxesOverlap,type PlaceLabel,type LabelBox} from '../../lib/geographicLabels';
import {slippyTile,loadPlaceTile} from '../../lib/localPlaceTiles';
const datasets=new Map<string,PlaceLabel[]>();
/** Uses the solar overview's projected DOM typography. World-facing occlusion,
 * scale tiers and screen-space collision keep names attached and legible. */
export function installPlaceLabels(C:Engine,v:Cesium.Viewer,getField:()=>CurrentField) {
 const root=document.createElement('div');root.className='earth-place-labels';v.container.appendChild(root);
 const abort=new AbortController(),loaded=new Set<string>(),nodes=new Map<string,{node:HTMLDivElement;text:HTMLSpanElement;sub:HTMLElement;place:PlaceLabel;width:number;height:number}>();
 let alive=true,dirty=true,countries:PlaceLabel[]=[],major:PlaceLabel[]=[],cities:PlaceLabel[]=[],local:PlaceLabel[]=[],locale='',candidates:PlaceLabel[]=[];
 let lastDraw=0,lastRefresh=0,lastZoom=-1,lastBounds='',lastTiles='',lastStreetMap=false,localState='idle',tileTimer:ReturnType<typeof setTimeout>|undefined,tileAbort:AbortController|undefined,moving=false,retryAt=0,retryTimer:ReturnType<typeof setTimeout>|undefined;
 const repaint=()=>{dirty=true;if(alive&&!v.isDestroyed())v.scene.requestRender();};
 const load=(name:string,assign:(data:PlaceLabel[])=>void)=>{
  if(loaded.has(name))return;loaded.add(name);
  const saved=datasets.get(name);if(saved){assign(saved);repaint();return;}
  fetch('/geo/'+name+'.json',{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Names unavailable');return r.json() as Promise<PlaceLabel[]>;}).then(data=>{if(!alive)return;datasets.set(name,data);assign(data);repaint();}).catch(()=>{});
 };
 const planTiles=(zoom:number)=>{
  const z=Math.max(10,Math.min(14,Math.floor(zoom))),found=new Map<string,{z:number;x:number;y:number}>(),canvas=v.scene.canvas;
  for(const x of [.15,.38,.62,.85])for(const y of [.2,.5,.8]){
   const ray=v.camera.getPickRay(new C.Cartesian2(canvas.clientWidth*x,canvas.clientHeight*y)),point=ray&&v.scene.globe.pick(ray,v.scene);
   if(!point)continue;const p=C.Cartographic.fromCartesian(point),tile=slippyTile(C.Math.toDegrees(p.longitude),C.Math.toDegrees(p.latitude),z);found.set(`${tile.z}/${tile.x}/${tile.y}`,tile);
  }
  const centre=useEarthView.getState(),c=slippyTile(centre.lon,centre.lat,z);found.set(`${c.z}/${c.x}/${c.y}`,c);
  const n=2**z;return [...found.values()].sort((a,b)=>{const dist=(t:typeof a)=>Math.min(Math.abs(t.x-c.x),n-Math.abs(t.x-c.x))**2+(t.y-c.y)**2;return dist(a)-dist(b);}).slice(0,9);
 };
 const queueTiles=(zoom:number)=>{
  if(!useEarthView.getState().externalPlaceDetails||zoom<10||moving||performance.now()<retryAt)return;
  const tiles=planTiles(zoom),key=tiles.map(t=>`${t.z}/${t.x}/${t.y}`).sort().join('|');if(key===lastTiles)return;
  lastTiles=key;clearTimeout(tileTimer);tileAbort?.abort();localState='loading';useEarthView.setState({placeNames:'loading'});
  tileTimer=setTimeout(async()=>{
   const controller=new AbortController();tileAbort=controller;let cursor=0,failed=0;const data:PlaceLabel[]=[];
   const worker=async()=>{while(cursor<tiles.length&&!controller.signal.aborted){const tile=tiles[cursor++];try{data.push(...await loadPlaceTile(tile,controller.signal));}catch{failed++;}}};
   await Promise.all([worker(),worker(),worker()]);if(!alive||controller.signal.aborted)return;
   local=data;localState=failed?'fallback':'ready';useEarthView.setState({placeNames:failed?'fallback':'ready'});if(failed){lastTiles='';retryAt=performance.now()+30000;clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(alive)repaint();},30000);}repaint();
  },350);
 };
 const offStart=v.camera.moveStart.addEventListener(()=>{moving=true;clearTimeout(tileTimer);tileAbort?.abort();lastTiles='';});
 const offEnd=v.camera.moveEnd.addEventListener(()=>{moving=false;lastTiles='';repaint();});
 const measure=document.createElement('canvas').getContext('2d')!;
 const ellipsoid=C.Ellipsoid.WGS84,scaledCamera=new C.Cartesian3(),scaledPoint=new C.Cartesian3(),lastPosition=new C.Cartesian3(),lastDirection=new C.Cartesian3();
 let reserved:LabelBox[]=[],lastLayout=0;
 const resizeObserver=new ResizeObserver(()=>{lastLayout=0;repaint();});resizeObserver.observe(v.scene.canvas);
 const occluder=new C.Occluder(new C.BoundingSphere(C.Cartesian3.ZERO,1),ellipsoid.transformPositionToScaledSpace(v.camera.positionWC,scaledCamera)),screen=new C.Cartesian2();
 const update=()=>{
  if(!alive)return;const time=performance.now(),cameraChanged=!C.Cartesian3.equalsEpsilon(lastPosition,v.camera.positionWC,0,.1)||!C.Cartesian3.equalsEpsilon(lastDirection,v.camera.directionWC,0,1e-8);if(!dirty&&(!cameraChanged||time-lastDraw<(moving?100:80)))return;lastDraw=time;C.Cartesian3.clone(v.camera.positionWC,lastPosition);C.Cartesian3.clone(v.camera.directionWC,lastDirection);const st=useAtlas.getState(),s=useEarthView.getState(),canvas=v.scene.canvas,w=canvas.clientWidth,h=canvas.clientHeight;
  root.hidden=!st.layers.labels&&!st.layers.currents&&!st.layers.wind&&!st.layers.windbelts;if(root.hidden)return;
  const zoom=labelZoom(v.camera.positionCartographic.height,h,s.lat,s.scaleMeters),now=performance.now();
  const streetMap=s.mapSource==='geoq'&&st.quality==='HIGH'&&s.detail==='ready'&&s.altitude<200000;
  root.dataset.light=String(streetMap);
  const r=v.camera.computeViewRectangle(),bounds=r?{west:C.Math.toDegrees(r.west),east:C.Math.toDegrees(r.east),south:C.Math.toDegrees(r.south),north:C.Math.toDegrees(r.north)}:undefined;
  const boundsKey=bounds?Object.values(bounds).map(v=>v.toFixed(2)).join(','):'';
  if(dirty||now-lastRefresh>250&& (Math.abs(zoom-lastZoom)>.05||boundsKey!==lastBounds)||locale!==st.locale||streetMap!==lastStreetMap){
   lastRefresh=now;lastZoom=zoom;lastBounds=boundsKey;locale=st.locale;lastStreetMap=streetMap;dirty=false;
   if(zoom>=3.5)load('country-labels',data=>countries=data);
   if(zoom>=5.2)load('major-city-labels',data=>major=data);
   if(zoom>=7.5)load('city-labels',data=>cities=data);
   queueTiles(zoom);
   const currentLabels:PlaceLabel[]=[];
   if(st.layers.currents)for(const current of CURRENTS){
    let best:{lon:number;lat:number;score:number}|undefined;
    const marine=oceanRouteSegments(current.path,(lon,lat)=>isWater(getField(),lon,lat),8);
    for(const segment of marine)for(const [lon,lat] of segment){
     if(!inGeographicBounds(lon,lat,bounds))continue;
     const point=C.Cartesian3.fromDegrees(lon,lat,800);occluder.cameraPosition=ellipsoid.transformPositionToScaledSpace(v.camera.positionWC,scaledCamera);
     if(!occluder.isPointVisible(ellipsoid.transformPositionToScaledSpace(point,scaledPoint)))continue;
     const projected=C.SceneTransforms.worldToWindowCoordinates(v.scene,point);if(!projected||projected.x<25||projected.y<110||projected.x>w-25||projected.y>h-90)continue;
     const score=(projected.x-w*.5)**2+(projected.y-h*.48)**2;if(!best||score<best.score)best={lon,lat,score};
    }
    if(best)currentLabels.push({id:'current:'+current.id,kind:'current',cn:current.name_cn,en:current.name_en.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()),lon:best.lon,lat:best.lat,rank:1,minZoom:0});
   }
   const base=[...(st.layers.labels?[...GLOBAL_LABELS,...FEATURE_LABELS,...countries,...(cities.length?cities:major),...local]:[]),...currentLabels,...(st.layers.wind||st.layers.windbelts?windLabels(s.lon,s.lat):[])];
   candidates=base.filter(p=>!(streetMap&&['country','city','region','road','poi'].includes(p.kind))&&(st.locale!=='en'||hasEnglishLabel(p.en))&&eligibleLabel(p,zoom)&&inGeographicBounds(p.lon,p.lat,bounds)&&(p.kind==='wind'?st.layers.wind||st.layers.windbelts:p.kind==='current'?st.layers.currents:p.kind==='ocean'?st.layers.ocean:st.layers.land||p.kind==='nature')).sort((a,b)=>a.rank-b.rank||(b.population||0)-(a.population||0)).slice(0,450);
   const ids=new Set(candidates.map(p=>p.id));for(const [id,e] of nodes)if(!ids.has(id)){e.node.remove();nodes.delete(id);}
   root.setAttribute('aria-label',locale==='en'?'Geographic labels on Earth':'地球地理标注');root.dataset.level=zoom<4?'world':zoom<7?'countries':zoom<11?'cities':'local';
   const typography=getComputedStyle(root);measure.font=`400 ${labelFontSize}px ${typography.fontFamily}`;
   for(const p of candidates){
    let e=nodes.get(p.id);if(!e){const node=document.createElement('div'),text=document.createElement('span'),sub=document.createElement('small');node.className='earth-place-label earth-place-label--'+p.kind;node.append(text,sub);if(p.kind==='wind'){node.setAttribute('role','button');node.tabIndex=0;const open=()=>useAtlas.getState().inspectWind(p.id.slice(5));node.onclick=e=>{e.stopPropagation();open();};node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};}if(p.kind==='country'&&(isDenmark(p.cn)||isDenmark(p.en))){node.classList.add('earth-place-label--interactive');node.setAttribute('role','button');node.tabIndex=0;const open=()=>{useAtlas.getState().setDenmarkMusic(true);useAtlas.getState().setPanel(null);useEarthView.getState().request({kind:'fly',lon:p.lon,lat:p.lat,range:2400000,pitch:-55});};node.onclick=e=>{e.stopPropagation();open();};node.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};}node.hidden=true;root.append(node);e={node,text,sub,place:p,width:0,height:0};nodes.set(p.id,e);}
    e.place=p;const text=labelText(p,locale);e.text.textContent=locale==='en'&&p.kind==='ocean'?text.toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase()):text;
    e.sub.textContent=p.subtitle?(locale==='en'?p.subtitle.en:p.subtitle.cn):'';e.node.title=text+' · '+labelCategory(p.kind,locale)+(p.kind==='wind'?(locale==='en'?' · Open explanation':' · 点击查看性质与季节变化'):'');if(p.kind==='wind')e.node.setAttribute('aria-label',text+(locale==='en'?' · Wind characteristics':' · 风的性质'));
    e.width=Math.max(measure.measureText(e.text.textContent).width,p.subtitle?measure.measureText(e.sub.textContent).width*10/labelFontSize:0)+16;e.height=p.kind==='wind'?44:24;
   }
  }
  // The same areas reserved by the HUD are also kept free of map typography.
  if(!lastLayout||time-lastLayout>500){lastLayout=time;const canvasBox=canvas.getBoundingClientRect();reserved=[...document.querySelectorAll('.app-header,.earth-search,.earth-navigation,.earth-footer,.earth-info-stack,.ocean-return,.workspace-panel,.nav-menu,.cloud-feed-status,.earth-stream-status,.earth-context-actions,.earth-help,.earth-provider-credit,.earth-label-credit,.earth-search-results')].filter(el=>{const style=getComputedStyle(el);return style.display!=='none'&&style.visibility!=='hidden';}).map(el=>{const b=el.getBoundingClientRect();return {left:b.left-canvasBox.left,top:b.top-canvasBox.top,right:b.right-canvasBox.left,bottom:b.bottom-canvasBox.top};}).filter(b=>b.right>b.left&&b.bottom>b.top);}
  const occupied:LabelBox[]=[...reserved];
  occluder.cameraPosition=ellipsoid.transformPositionToScaledSpace(v.camera.positionWC,scaledCamera);let count=0;const names=new Set<string>(),max=labelBudget(w,h);
  for(const p of candidates){
   const e=nodes.get(p.id)!;e.node.hidden=true;const opacity=labelOpacity(p,zoom);if(count>=max||opacity<.08)continue;e.node.style.opacity=String(opacity*.86);
   const geo=C.Cartographic.fromDegrees(p.lon,p.lat),ground=v.scene.globe.getHeight(geo)||0,point=C.Cartesian3.fromDegrees(p.lon,p.lat,Math.max(0,ground)+20);
   if(!occluder.isPointVisible(ellipsoid.transformPositionToScaledSpace(point,scaledPoint)))continue;
   const lift=60000*Math.max(0,Math.min(1,(v.camera.positionCartographic.height-180000)/220000));
   const aboveCloud=p.kind==='current'||p.kind==='wind'?Math.max(0,ground)+800:Math.max(0,ground)+20+lift;
   const projected=C.SceneTransforms.worldToWindowCoordinates(v.scene,C.Cartesian3.fromDegrees(p.lon,p.lat,aboveCloud),screen);if(!projected)continue;
   let x=projected.x;const y=projected.y-(p.kind==='current'?12:0);
   // Large area names can slide slightly inward on narrow screens; city/street
   // anchors retain exact projected positions.
   if(p.kind==='continent'||p.kind==='ocean'){const fitted=Math.max(10+e.width/2,Math.min(w-12-e.width/2,x));if(Math.abs(fitted-x)<48)x=fitted;}
   const box={left:x-e.width/2,top:y-e.height/2,right:x+e.width/2,bottom:y+e.height/2};
   const key=labelText(p,locale).toLowerCase();if(names.has(key)||box.left<10||box.right>w-12||box.top<100||box.bottom>h-20||occupied.some(b=>boxesOverlap(b,box)))continue;
   occupied.push(box);names.add(key);count++;e.node.hidden=false;e.node.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
  }

 };
 const offRender=v.scene.postRender.addEventListener(update),offState=useAtlas.subscribe((s,p)=>{if(s.locale!==p.locale||s.layers!==p.layers||s.panel!==p.panel||s.overlay!==p.overlay||s.quality!==p.quality){dirty=true;lastLayout=0;v.scene.requestRender();}});
 const fontReady=()=>{if(alive)repaint();};document.fonts.ready.then(fontReady);document.fonts.addEventListener('loadingdone',fontReady);
 repaint();return()=>{alive=false;resizeObserver.disconnect();document.fonts.removeEventListener('loadingdone',fontReady);abort.abort();tileAbort?.abort();clearTimeout(tileTimer);clearTimeout(retryTimer);offStart();offEnd();offRender();offState();root.remove();useEarthView.setState({placeNames:'idle'});};
}
