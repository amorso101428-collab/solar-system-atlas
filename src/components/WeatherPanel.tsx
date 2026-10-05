import {chinaStamp} from "../lib/format";
import { useEffect, useState } from "react";
import { readPoint, useWeather, type WeatherPoint } from "../lib/weather";
import { useLanguage } from "../i18n";
export default function WeatherPanel(){
 const {t}=useLanguage(),point=useWeather(s=>s.point),inspect=useWeather(s=>s.inspect);const [data,setData]=useState<WeatherPoint|null>(null),[state,setState]=useState("loading"),[retry,setRetry]=useState(0);
 const [lon,setLon]=useState(point.lon.toFixed(2)),[lat,setLat]=useState(point.lat.toFixed(2));
 useEffect(()=>{setLon(point.lon.toFixed(2));setLat(point.lat.toFixed(2));setData(null);setState("loading");const c=new AbortController(),timer=setTimeout(()=>c.abort(),20000);readPoint(point.lon,point.lat,c.signal).then(d=>{if(!c.signal.aborted){setData(d);setState("ready");}}).catch(()=>{if(!c.signal.aborted)setState("error");else if(c.signal.reason?.name==="AbortError")setState("error");}).finally(()=>clearTimeout(timer));return()=>{clearTimeout(timer);c.abort("unmount");};},[point.lon,point.lat,retry]);
 const val=(n:number|null|undefined,unit:string)=>typeof n==="number"&&Number.isFinite(n)?`${n.toFixed(2)} ${unit}`:t("此处无数据","No data at this location");
 return <div><p>{t("点击地球选取位置，也可输入坐标。","Select a location on the globe, or enter coordinates.")}</p>
 <form className="coordinate-form" onSubmit={e=>{e.preventDefault();const lo=Number(lon),la=Number(lat);if(Number.isFinite(lo)&&Number.isFinite(la)&&la>=-85&&la<=85)inspect(lo,la);}}><label>{t("经度","Longitude")}<input type="number" min="-180" max="180" step=".01" required value={lon} onChange={e=>setLon(e.target.value)}/></label><label>{t("纬度","Latitude")}<input type="number" min="-85" max="85" step=".01" required value={lat} onChange={e=>setLat(e.target.value)}/></label><button className="tag">{t("查询","Inspect")}</button></form>
 {state==="loading"&&<p role="status">{t("正在读取气象和海洋预报…","Loading weather and marine forecasts…")}</p>}
 {state==="error"&&<div className="notice" role="status">{t("预报暂不可用。位置已保留。","Forecast unavailable. Your location is preserved.")}<button onClick={()=>setRetry(retry+1)}>{t("重试","Retry")}</button></div>}
 {data&&<><h3>{t("当前位置预报","Forecast at this location")}</h3><dl className="dossier__rows"><div><dt>{t("10 米风速","Wind at 10 m")}</dt><dd>{val(data.wind,"m/s")}</dd></div><div><dt>{t("风的来向","Wind from")}</dt><dd>{val(data.direction,"°")}</dd></div><div><dt>{t("降水","Precipitation")}</dt><dd>{val(data.rain,"mm")}</dd></div><div><dt>{t("海表流速","Surface current")}</dt><dd>{val(data.current,"m/s")}</dd></div><div><dt>{t("洋流流向","Current towards")}</dt><dd>{val(data.currentDirection,"°")}</dd></div></dl><p className="panel__hint">{t("气象有效时间","Weather valid time")} · {chinaStamp(data.time)}<br/>{t("海流有效时间","Current valid time")} · {data.marineTime?chinaStamp(data.marineTime):"—"}</p></>}
 <p className="panel__hint">{t("气象为 Open-Meteo 数值模式预报；海流来自 Copernicus / Météo-France SMOC。不是现场观测。底部时间轴仅控制模拟洋流。","Weather is an Open-Meteo model forecast; currents are from Copernicus / Météo-France SMOC. These are not in-situ observations. The timeline only controls simulated currents.")}</p><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo · CC BY 4.0</a>
 </div>;
}
