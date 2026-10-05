import EarthNavigator from "./earth/EarthNavigator";
import UIMotionControl from "./UIMotionControl";
import MusicSwitch from "./MusicSwitch";
import QualitySlider from "./QualitySlider";
import WindPanel from "./WindPanel";
import {useEarthView} from "../lib/earthEngine";
import { useEffect, useRef, useState } from "react";
import { useAtlas, type Panel, type View } from "../state/store";
import { CURRENTS } from "../data/currents";
import { SPECIES } from "../data/species";
import { OCEANS } from "../data/oceans";
import { GROUPS, GROUP_LABEL, LAYERS } from "../lib/layerRegistry";
import { chinaStamp, forecastIsStale } from "../lib/format";
import { useLanguage } from "../i18n";
import GeographyPanel from "./GeographyPanel";
import DivePanel from "./DivePanel";
import Dossier from "./Dossier";
import ArchiveContents from "./ArchiveContents";
import ScienceReading from "./ScienceReading";
import WaterColumn from "./WaterColumn";
import WeatherPanel from "./WeatherPanel";
import {useImagery} from "../lib/imagery";
import {returnToSolar,returnToUniverse} from "../lib/handoff";
import {useWeather} from "../lib/weather";

export function LanguageSwitch(){
 const {locale,t}=useLanguage();const set=useAtlas(s=>s.setLocale);
 return <div className="language" aria-label={t("语言","Language")}>
  <button aria-pressed={locale==="zh-CN"} onClick={()=>set("zh-CN")}>中文</button>
  <button aria-pressed={locale==="en"} onClick={()=>set("en")}>EN</button>
 </div>;
}
function CloudStatus(){
 const {t}=useLanguage();const close=useEarthView(s=>s.altitude<2000000);
 return <div className="cloud-feed-status" role="status"><strong>{close?t("地表浏览 · 云层自动淡出","Surface exploration · Clouds fade automatically"):t("摄影云层","Photographic clouds")}</strong><span>{t("保存的卫星摄影合成 · 非实时影像","Saved satellite composite · Not a live image")}</span><small><a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small></div>;
}
function BeijingNow(){const [now,setNow]=useState(Date.now);const {t}=useLanguage();useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);return <small>{t("北京时间","Beijing time")} · {chinaStamp(now)}</small>;}
function DetailStatus(){const {t}=useLanguage();const near=useEarthView(s=>s.altitude<2000000),status=useEarthView(s=>s.detail),map=useEarthView(s=>s.mapSource);if(!near||map!=='geoq'&&map!=='satellite')return null;return <div className="cloud-feed-status" role="status"><strong>{map==='satellite'?t("卫星影像 · Esri","Satellite imagery · Esri"):t("街道地图 · GeoQ","Street map · GeoQ")}</strong><small>{status==='error'?t("在线影像暂不可用，保留本地照片","Online imagery unavailable; retaining saved photograph"):status==='ready'?map==='satellite'?t("卫星与航空摄影 · 按需加载缓存","Satellite and aerial photography · Cached on demand"):t("街道底图 · 按需加载缓存","Street basemap · Cached on demand"):t("正在细化地表，保留底图","Refining the surface; retaining basemap")}</small></div>;}
function LayerPanel(){
 const terrainAvailable=useEarthView(s=>s.externalTerrain);
 const {t,locale,text}=useLanguage();const layers=useAtlas(s=>s.layers),toggle=useAtlas(s=>s.toggleLayer),view=useAtlas(s=>s.view);
 return <div className="layer-list">
  <p className="panel__hint">{t("自然地球为默认视图。开启图层可探索海洋数据。","The natural Earth is the default. Enable layers to explore ocean data.")}</p>
  {GROUPS.map(g=><section key={g}><h3>{locale==="en"?GROUP_LABEL[g].en:GROUP_LABEL[g].cn}</h3>
   {LAYERS.filter(l=>l.group===g).map(l=>{
    const mapOnly=false; const globeOnly=["land","ocean","stars","clouds","atmosphere","airglow","relief"].includes(l.id);const cloudsBlocked=l.id==="clouds"&&["currents","wind","rain","cloudcover","field","warmcold","relief"].some(k=>layers[k]);
    const terrainBlocked=l.id==="landrelief"&&!terrainAvailable;const available=l.live && !terrainBlocked && !cloudsBlocked && view!=="DEPTH" && (!mapOnly||view==="MAP") && (!globeOnly||view==="GLOBE");
    return <div className="layer-item" key={l.id}>
     <button role="switch" aria-checked={!!layers[l.id]} disabled={!available} onClick={()=>toggle(l.id)}>
      <span>{locale==="en"?l.en:l.cn}<small>{terrainBlocked?t("本地影像模式：未接入高程服务","Saved imagery: elevation service not connected"):!l.live?t("尚未接入","Not connected"):cloudsBlocked?t("分析图层开启时自动隐藏","Hidden while analysis layers are active"):!available?t("当前视图不支持","Unavailable in this view"):text(l.provenance)}</small></span>
      <i className={layers[l.id]?"switch is-on":"switch"}/>
     </button>
     <details><summary>{t("数据来源","Source")}</summary><p>{l.source.name} · {l.source.resolution||"—"}{l.source.license&&<> · {l.source.license}</>}</p>{l.source.url&&<a href={l.source.url.startsWith("http")?l.source.url:"https://"+l.source.url} target="_blank" rel="noreferrer">{t("查看原始来源","Open original source")} ↗</a>}</details>
    </div>;
   })}
  </section>)}
 </div>;
}
function LibraryPanel(){
 const {t,name,text}=useLanguage();const q=useAtlas(s=>s.libraryQuery),tab=useAtlas(s=>s.libraryTab),setLibrary=useAtlas(s=>s.setLibrary);
 const select=useAtlas(s=>s.select),focus=useAtlas(s=>s.focusOn);
 const data=tab==="species"?SPECIES:tab==="ocean"?OCEANS:CURRENTS;
 const items=data.filter(x=>(x.name_en+x.name_cn+("sci" in x?x.sci:"")).toLowerCase().includes(q.toLowerCase()));
 return <div>
  <label className="search-label">{t("搜索名称或学名","Search name or scientific name")}
   <input type="search" value={q} onChange={e=>setLibrary({libraryQuery:e.target.value})} placeholder={t("蓝鲸、黑潮…","Blue whale, Kuroshio…")}/>
  </label>
  <div className="tagrow" role="tablist" aria-label={t("资料类型","Catalog type")}>
   {[["current",t("洋流","Currents")],["species",t("物种","Species")],["ocean",t("海洋","Oceans")]].map(([k,n])=><button role="tab" aria-selected={tab===k} key={k} className={tab===k?"tag is-on":"tag"} onClick={()=>setLibrary({libraryTab:k as "current"|"species"|"ocean"})}>{n}</button>)}
  </div>
  <div className="catalog-list">{items.map(x=><button key={x.id} onClick={()=>{
   select({kind:tab as "current"|"ocean"|"species",id:x.id});
   if("lon" in x)focus(x.lon,x.lat);else{const p=x.path[Math.floor(x.path.length/2)];focus(p[0],p[1]);}
  }}><span>{name(x)}<small>{"sci" in x?x.sci:"kind" in x?text(x.kind):t("海洋档案","Ocean dossier")}</small></span><span aria-hidden>↗</span></button>)}</div>
  {!items.length&&<p>{t("没有找到匹配结果","No matching results")}</p>}
 </div>;
}
function StatusPanel(){
 const {t,text}=useLanguage();const field=useAtlas(s=>s.field),time=useAtlas(s=>s.time),quality=useAtlas(s=>s.quality);
 const terrainState=useEarthView(s=>s.terrain),imageryState=useEarthView(s=>s.imagery),retryEarth=useEarthView(s=>s.request);
 const setQuality=useAtlas(s=>s.setQuality),reduced=useAtlas(s=>s.reducedMotion),setReduced=useAtlas(s=>s.setReducedMotion);
 return <div>
  <div className="notice">{field.simulated?t("当前洋流为模拟场，用于演示环流结构。","The current field is simulated to illustrate circulation."):t("当前使用已发布流场数据。","A published current field is active.")}</div>
  <dl className="dossier__rows">
   <div><dt>{t("来源","Source")}</dt><dd>{field.source}</dd></div>
   <div><dt>{t("有效时间","Valid time")}</dt><dd>{chinaStamp(field.timestamp)}</dd></div>
   <div><dt>{t("演示时间","Display time")}</dt><dd>{chinaStamp(time.simTime)}</dd></div>
   <div><dt>{t("分辨率","Resolution")}</dt><dd>{field.resolution}</dd></div>
   <div><dt>{t("状态","Status")}</dt><dd>{field.simulated?text("SIMULATED"):t("已发布","Published")}</dd></div>
  </dl>
  {(terrainState==="error"||imageryState==="error")&&<div className="notice" role="status">{terrainState==="error"?t("地形暂不可用，仍可浏览卫星影像。","Terrain is unavailable; satellite imagery remains accessible."):t("在线影像暂不可用，保留本地地球底图。","Online imagery is unavailable; the saved Earth basemap remains visible.")} <button className="tbtn" onClick={()=>retryEarth({kind:"retry"})}>{t("重试","Retry")}</button></div>}
  <QualitySlider value={quality} onChange={setQuality} reduced={reduced} />
  <div className="ui-motion-setting"><span>{t("界面过渡与按钮反馈","Panel transitions & button feedback")}</span><UIMotionControl/></div>
  <label className="motion-setting"><input type="checkbox" role="switch" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>{t("减少动态效果","Reduce motion")}</label>
 </div>;
}
function TimeBar(){
 const {t}=useLanguage();const time=useAtlas(s=>s.time),field=useAtlas(s=>s.field),setPlaying=useAtlas(s=>s.setPlaying),setRate=useAtlas(s=>s.setRate),setTime=useAtlas(s=>s.setSimTime),setSpan=useAtlas(s=>s.setSpan);
 const expanded=useAtlas(s=>s.overlay==="time"),setExpanded=(value:boolean)=>useAtlas.getState().setOverlay(value?"time":null);
 const H=3600000,anchor=field.simulated?Date.now():field.updatedAt;
 const start=anchor-(time.span==="past72h"?72:time.span.startsWith("future")?2:24)*H;
 const end=time.span==="future10d"?anchor+240*H:time.span==="future24h"?anchor+24*H:anchor;
 return <div className={"timeline"+(expanded?" is-expanded":"")}>
  <button className="timeline-toggle" aria-expanded={expanded} onClick={()=>{setExpanded(!expanded);}}>{field.simulated?t("模拟洋流 · 时间","Simulated currents · Time"):t("时间控制","Time controls")} <time>{chinaStamp(time.simTime)}</time><span>{expanded?"−":"+"}</span></button>
  <div className="timeline-content">
   <div className="timeline-heading"><span>{field.simulated?time.followNow?t("北京时间 · 跟随现在","Beijing time · Now"):t("回放时间 · UTC+8","Replay time · UTC+8"):t("数据时间","Data time")}</span><time>{chinaStamp(time.simTime)}</time></div>
   <input aria-label={t("时间轴","Time slider")} type="range" min={start} max={end} step={60000} value={Math.max(start,Math.min(end,time.simTime))} onChange={e=>setTime(Number(e.target.value))}/>
   <div className="tagrow">
    <button className="tag" onClick={()=>setPlaying(!time.playing)}>{time.playing?t("暂停","Pause"):t("播放","Play")}</button>
    {[.25,.5,1,2].map(r=><button aria-pressed={r===time.rate} className={r===time.rate?"tag is-on":"tag"} key={r} onClick={()=>setRate(r)}>{r}×</button>)}
    <button className="tag" onClick={()=>useAtlas.getState().followCurrentTime()}>{t("现在","Now")}</button>
    {(["past24h","past72h","future24h","future10d"] as const).map((s,i)=><button aria-pressed={s===time.span} className={s===time.span?"tag is-on":"tag"} key={s} onClick={()=>setSpan(s)}>{[t("过去24时","Past 24h"),t("过去72时","Past 72h"),t("未来24时","Next 24h"),t("未来10天","Next 10d")][i]}</button>)}
   </div>
  </div>
 </div>;
}
export default function Hud({scale}:{scale:string}){
 const [infoExpanded,setInfoExpanded]=useState(false);
 const {t,text,locale}=useLanguage();const overlay=useAtlas(s=>s.overlay),menu=overlay==="view"||overlay==="layers"||overlay==="tools"?overlay:null;const setMenu=(value:"view"|"layers"|"tools"|null)=>{const s=useAtlas.getState();if(value||["view","layers","tools"].includes(s.overlay??""))s.setOverlay(value);};const menuRoot=useRef<HTMLDivElement>(null);const panel=useAtlas(s=>s.panel),setPanel=useAtlas(s=>s.setPanel),view=useAtlas(s=>s.view),setView=useAtlas(s=>s.setView),close=useAtlas(s=>s.closeDossier);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(menuRoot.current&&!menuRoot.current.contains(e.target as Node))setMenu(null);};const escape=(e:KeyboardEvent)=>{if(e.key==="Escape")setMenu(null);};window.addEventListener("pointerdown",close);window.addEventListener("keydown",escape);return()=>{window.removeEventListener("pointerdown",close);window.removeEventListener("keydown",escape);};},[]);
 const imagery=useImagery();const weatherGrid=useWeather(s=>s.grid),weatherOnline=useWeather(s=>s.online),weatherRefreshing=useWeather(s=>s.refreshing);const setAnalysis=useAtlas(s=>s.setAnalysis);const selection=useAtlas(s=>s.selection);
 const simulated=useAtlas(s=>s.field.simulated);
 const health=useAtlas(s=>s.dataHealth),reload=useAtlas(s=>s.requestReload),hover=useAtlas(s=>s.hover);
 const toolRefs=useRef<Partial<Record<NonNullable<Panel>,HTMLButtonElement|null>>>({});
 const dismiss=()=>{if(panel==="dossier")useAtlas.getState().backDossier();else setPanel(null);toolRefs.current[panel as NonNullable<Panel>]?.focus();};
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!document.querySelector("dialog[open]")){if(useAtlas.getState().panel==="dossier")useAtlas.getState().backDossier();else useAtlas.getState().setPanel(null);}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[]);
 const layers=useAtlas(s=>s.layers),toggle=useAtlas(s=>s.toggleLayer),weatherState=useWeather(s=>s.state),loadWeather=useWeather(s=>s.load),requestCamera=useAtlas(s=>s.requestCamera);
 useEffect(()=>{if((layers.wind||layers.rain)&&weatherState==="idle")loadWeather();},[layers.wind,layers.rain,weatherState,loadWeather]);
 const tools:[NonNullable<Panel>,string][]=[["layers",t("图层","Layers")],["library",t("资料库","Library")],["learn",t("探索路径","Explore")],["dive",t("潜水","Dive")]];
 const lightMap=useEarthView(s=>s.mapSource==='geoq'&&s.altitude<500000);
 const title=panel==="winds"?t("风带与季风","Wind belts & monsoons"):panel==="profile"?t("深海剖面","Depth profile"):panel==="sky"?t("星空与观测","Stars & observation"):panel==="earth"?t("蓝色星球","The blue planet"):panel==="status"?t("数据与设置","Data & settings"):panel==="weather"?t("位置气象与海流","Weather & currents"):panel==="dossier"?t("生物与海洋档案","Feature dossier"):tools.find(([k])=>k===panel)?.[1];
 return <div className="ui-layer" data-light-map={lightMap}>
  <header className="app-header" ref={menuRoot}>
   <div className="earth-primary-nav">
    <button aria-label={t("主页","Home")} className="atlas-home" onClick={()=>{setPanel(null);returnToUniverse(locale);}}><span aria-hidden>⌂</span><small>{t("主页","Home")}</small></button>
    <div className="earth-explore-links">
     <button className="solar-back" onClick={()=>returnToSolar(locale)}>{t("← 地球系统","← Earth system")}</button>
   <nav className="atlas-nav" aria-label={t("探索导航","Explore navigation")}>
    <div className="nav-dropdown"><button aria-expanded={menu==="view"} onClick={()=>setMenu(menu==="view"?null:"view")}>{t("地球","Earth")} <small>{layers.rain?t("降水","Rain"):layers.wind?t("风场","Wind"):layers.currents?t("洋流","Currents"):t("自然视图","Natural view")}</small></button>
    {menu==="view"&&<div className="nav-menu atlas-blinds">{([["natural",t("自然地球","Natural Earth"),t("陆地、海洋、云层与大气","Land, ocean, clouds and atmosphere")],["currents",t("海洋环流","Ocean circulation"),t("地球表面动态洋流 · 自动隐藏云层","Moving currents on the globe · Clouds hidden")],["wind",t("全球风场","Global wind"),t("连续风速色带与流线 · 10 米风","Continuous wind speed and streamlines · 10 m wind")],["rain",t("全球降水","Global precipitation"),t("降水强度色带 · 毫米/小时","Precipitation intensity · mm/h")]] as ["natural"|"currents"|"wind"|"rain",string,string][]).map(([k,n,h])=><button key={k} onClick={()=>{setAnalysis(k);setMenu(null);}}><span>{n}</span><small>{h}</small></button>)}<button onClick={()=>{setPanel("profile");setMenu(null);}}><span>{t("深海剖面","Ocean depth profile")}</span><small>{t("保留地球，在档案中读温盐与水层","Keep the globe; explore profiles in the archive")}</small></button><button onClick={()=>{setPanel("earth");setMenu(null);}}><span>{t("认识这颗星球","Read about this planet")} ↗</span></button></div>}</div>
    <div className="nav-dropdown"><button aria-expanded={menu==="layers"} onClick={()=>setMenu(menu==="layers"?null:"layers")}>{t("图层","Layers")} <small>{t("数据与环境","Data & environment")}</small></button>{menu==="layers"&&<div className="nav-menu atlas-blinds">{[["labels",t("地理标注","Geographic labels")],["currents",t("洋流","Currents")],["wind",t("风","Wind")],["rain",t("降水","Rain")]].map(([k,n])=><button key={k} disabled={view==="DEPTH"} role="switch" aria-checked={!!layers[k]} onClick={()=>toggle(k)}><span>{n}</span><i className={layers[k]?"switch is-on":"switch"}/></button>)}<button onClick={()=>{setPanel("layers");setMenu(null);}}><span>{t("全部图层与来源","All layers & sources")} ↗</span></button><button onClick={()=>{setPanel("weather");setMenu(null);}}><span>{t("查询位置气象与海流","Inspect local weather & currents")} ↗</span></button></div>}</div>
   </nav>
     <div className="utility-links primary-tools">{tools.filter(([p])=>p!=="layers").map(([p,n])=><button ref={el=>{toolRefs.current[p]=el;}} key={p} aria-expanded={panel===p} onClick={()=>setPanel(panel===p?null:p)}>{n}</button>)}</div>
     <div className="nav-dropdown mobile-tools"><button aria-expanded={menu==="tools"} onClick={()=>setMenu(menu==="tools"?null:"tools")}>{t("工具","Tools")}</button>{menu==="tools"&&<div className="nav-menu atlas-blinds">{tools.filter(([p])=>p!=="layers").map(([p,n])=><button key={p} onClick={()=>{setPanel(p);setMenu(null);}}><span>{n}</span></button>)}</div>}</div>
    </div>
   </div>
   <div className="atlas-utilities">
    <div className="desktop-ui-motion"><UIMotionControl/></div>
    <MusicSwitch/>
    <button className="locale-toggle" aria-label={t("切换为英语","Switch to Chinese")} onClick={()=>useAtlas.getState().setLocale(locale==="en"?"zh-CN":"en")}>中 / EN</button>
    <button ref={el=>{toolRefs.current.status=el;}} aria-expanded={panel==="status"} onClick={()=>setPanel(panel==="status"?null:"status")}>{t("设置","Settings")}</button>
   </div>
  </header>
  <div className="view-context"><strong>{layers.rain?t("雨水在星球上流转","Water moving through the atmosphere"):layers.wind?t("看见空气的流动","See the atmosphere in motion"):layers.currents?t("追随海洋的脉络","Follow the ocean’s circulation"):t("我们的蓝色星球","Our blue planet")}</strong><p>{t("旋转 · 放大 · 选择海洋\n星空也会随视角展开","Rotate · Zoom · Select an ocean\nExplore the stars as your view changes")}</p></div>
  {view==="GLOBE"&&<EarthNavigator/>}
  <div className="earth-info-stack" data-collapsed={!infoExpanded}>
  <button className="earth-info-toggle" aria-expanded={infoExpanded} onClick={()=>setInfoExpanded(value=>!value)}>{t("图例与数据说明","Legend & data")} <span aria-hidden>{infoExpanded?'−':'+'}</span></button>
  {(layers.wind||layers.rain||layers.cloudcover)&&<div className="weather-legend" role="status">{weatherState==="ready"&&weatherGrid?<><strong>{layers.cloudcover?t("云量覆盖率 · %","Cloud coverage · %"):layers.rain?t("降水强度 · mm/h","Precipitation · mm/h"):t("10 米风速 · m/s","Wind at 10 m · m/s")}</strong><div className={"weather-scale "+(layers.cloudcover?"cloud-scale":layers.rain?"rain-scale":"wind-scale")}/><div className="scale-ticks">{(layers.cloudcover?[0,20,40,60,80,100]:layers.rain?[.1,1,2.5,5,10,20,30]:[0,5,12,22,30,40]).map(v=><span key={v}>{v}</span>)}</div><BeijingNow/><small>{t("预报有效时间","Forecast valid time")} · {chinaStamp(layers.cloudcover?weatherGrid.cloudTime||weatherGrid.validTime:layers.rain?weatherGrid.rainTime||weatherGrid.validTime:weatherGrid.validTime)}</small><small>GFS · {weatherGrid.displayResolution}{forecastIsStale(weatherGrid.validTime)?t(" · 旧预报，等待更新"," · Older forecast, awaiting update"):""}</small><div className="feed-state"><span>{weatherOnline?(weatherGrid.updating?t("检查预报更新中","Checking forecast update"):t("预报 · 自动检查更新","Forecast · Auto refresh")):t("保存的预报 · 保留上次数据","Saved forecast · Retaining data")}</span><button disabled={weatherRefreshing} onClick={loadWeather} aria-label={t("刷新气象数据","Refresh weather data")}>{weatherRefreshing?"…":"↻"}</button></div>{layers.wind&&<button className="wind-info-link" onClick={()=>useAtlas.getState().inspectWind(null)}>{t("风带与季风 · 名称与性质","Wind belts & monsoons · Names & traits")} ↗</button>}</>:weatherState==="error"?<>{t("气象图层加载失败","Weather layer unavailable")} <button onClick={loadWeather}>{t("重试","Retry")}</button></>:t("正在加载全球气象场…","Loading the global weather field…")}</div>}
  <DetailStatus/>
  {layers.clouds&&<CloudStatus/>}
  {layers.currents&&!layers.wind&&!layers.rain&&<div className="current-legend">{simulated?t("表层洋流 · 模拟 · 流线沿流向移动","Surface currents · Simulated · Streaks follow the flow"):t("表层洋流 · 模式数据 · 流线沿流向移动","Surface currents · Model data · Streaks follow the flow")}<small>{t("云层已隐藏，退出分析后恢复","Clouds hidden; restored after analysis")}</small></div>}
  {layers.currents&&<TimeBar/>}
  </div>
  {view==="GLOBE"&&imagery.active&&<div className="imagery-credit" role="status">{imagery.loaded===0?(imagery.failed===imagery.total?<>{t("影像加载失败，保留地球底图","Imagery unavailable; Earth basemap retained")} <button onClick={imagery.retry}>{t("重试","Retry")}</button></>:t("正在加载卫星影像…","Loading satellite imagery…")):t("国内在线地图","Domestic online map")} · GeoQ 智图</div>}
  {health!=="OK"&&<div className="data-alert" role="status">{health==="UNAVAILABLE"?t("洋流数据不可用，正在显示模拟场。","Current data unavailable. Showing a simulated field."):t("流场加载失败，保留可用数据。","Field loading failed. Keeping available data.")}<button onClick={reload}>{t("重试","Retry")}</button></div>}
  {panel&&<aside className={"workspace-panel is-floating"+(panel==="status"?" is-settings":"")+(["dossier","learn","earth","sky"].includes(panel)?" has-contents":"")} aria-label={title} data-light-map={lightMap}>
   <div className="workspace-panel__head"><h2>{title}</h2><button aria-label={panel==="dossier"?t("返回上一层","Back"):t("关闭面板","Close panel")} onClick={dismiss}>{panel==="dossier"?"←":"×"}</button></div>
   {["dossier","learn","earth","sky"].includes(panel)&&<ArchiveContents identity={panel+selection.id}/>}
   <div className="workspace-panel__body" key={panel}>
    {panel==="profile"&&<WaterColumn/>}{panel==="sky"&&<ScienceReading kind="sky"/>}{panel==="earth"&&<ScienceReading kind="earth"/>}{panel==="layers"&&<LayerPanel/>}{panel==="library"&&<LibraryPanel/>}{panel==="learn"&&<GeographyPanel/>}{panel==="dive"&&<DivePanel/>}{panel==="status"&&<StatusPanel/>}{panel==="dossier"&&<Dossier/>}{panel==="weather"&&<WeatherPanel/>}{panel==="winds"&&<WindPanel/>}
   </div>
  </aside>}
  <div className="scene-hint">{view==="GLOBE"?t("拖动旋转 · 滚轮缩放 · 点击海洋查看档案","Drag to rotate · Scroll to zoom · Select an ocean") : view==="MAP"?t("拖动平移 · 滚轮缩放 · 点击查看档案","Drag to pan · Scroll to zoom · Select a feature"):t("从阳光海面，到超深渊","From sunlit waters to the hadal zone")}<span>{scale==="SURFACE"?t("地表影像","Surface imagery"):text(scale)}</span></div>
  {hover&&!panel&&<div className="hovercard" style={{left:Math.min(hover.x+14,window.innerWidth-220),top:Math.min(hover.y+14,window.innerHeight-100)}}><small>{text(hover.label)}</small><strong>{text(hover.sub)}</strong><span>{t("点击查看档案","Select to open dossier")}</span></div>}
 </div>;
}
