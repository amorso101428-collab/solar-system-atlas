import ScienceReading from "./ScienceReading";
import SpeciesDetail from "./SpeciesDetail";
import { useAtlas } from "../state/store";
import { findCurrent } from "../data/currents";
import { findSpecies, SPECIES } from "../data/species";
import { OCEANS, SEAWATER } from "../data/oceans";
import { findDiveSite } from "../data/divesites";
import { sampleUV, flowLevel, bearing } from "../lib/currentField";
import { useLanguage } from "../i18n";

export default function Dossier(){
 const {t,text,name}=useLanguage();const sel=useAtlas(s=>s.selection),select=useAtlas(s=>s.select),field=useAtlas(s=>s.fieldData);
 const current=sel.kind==="current"?findCurrent(sel.id!):null, ocean=sel.kind==="ocean"?OCEANS.find(o=>o.id===sel.id):null;
 const species=sel.kind==="species"?findSpecies(sel.id!):null, dive=sel.kind==="dive"?findDiveSite(sel.id!):null;
 if(species)return <SpeciesDetail key={species.id} species={species}/>;
 const item=current||ocean||dive;
 if(!item)return <p>{t("请选择一个对象","Select a feature")}</p>;
 const rows:(string[])[]=current?[[t("速度","Speed"),current.speed],[t("温度","Temperature"),current.temperature],[t("盐度","Salinity"),current.salinity],[t("深度","Depth"),current.depth],[t("季节","Season"),current.season]]
 :ocean?[[t("面积","Area"),`${ocean.areaMkm2} ${t("百万平方千米","million km²")}`],[t("体积","Volume"),`${ocean.volumeMkm3} ${t("百万立方千米","million km³")}`],[t("平均深度","Mean depth"),`${ocean.meanDepth.toLocaleString()} m`],[t("最大深度","Maximum depth"),`${ocean.maxDepth.toLocaleString()} m`],[t("最深处","Deepest point"),ocean.deepestPoint],[t("海岸线","Coastline"),`${ocean.coastlineKm.toLocaleString()} km`],[t("盐度","Salinity"),ocean.salinity],[t("表层温度","Surface temperature"),ocean.surfaceTemp],[t("深层温度","Deep temperature"),ocean.deepTemp],[t("物种","Species"),ocean.speciesCount]]
 :dive?[[t("水温","Water temperature"),dive.tempC],[t("能见度","Visibility"),dive.visibility],[t("深度","Depth"),dive.depth],[t("季节","Season"),dive.season],[t("水域","Water type"),dive.waterType],[t("抵达方式","Access"),dive.access],[t("典型流况","Typical flow"),dive.baseFlow],[t("坐标","Coordinates"),`${Math.abs(dive.lat).toFixed(2)}°${dive.lat>=0?"N":"S"} ${Math.abs(dive.lon).toFixed(2)}°${dive.lon>=0?"E":"W"}`]]:[];
 const sections:[string,string|string[]][]=current?[[t("成因","Formation"),current.formation],[t("地理","Geography"),current.geography],[t("气候","Climate"),current.climate],[t("渔场","Fishery"),current.fishery],[t("潜水参考","Dive notes"),current.dive]]
 :ocean?[[t("主要洋流","Major currents"),ocean.currents],[t("地形","Seafloor forms"),ocean.forms],[t("生态","Ecology"),ocean.ecology],[t("特有性","Endemism"),ocean.endemics],[t("构造","Tectonics"),ocean.tectonics],[t("人类活动","Human activity"),ocean.human]]
 :dive?[[t("常见生物","Marine life"),dive.life],[t("装备参考","Gear reference"),dive.gear],[t("注意事项","Conditions to watch"),dive.watch],[t("说明","Notes"),dive.note]]:[];
 let cond=null;
 if(dive&&field){const [u,v]=sampleUV(field,dive.lon,dive.lat),speed=Math.hypot(u,v);cond={speed,dir:bearing(u,v),level:flowLevel(speed)};}
 return <article className="dossier-content">
  <header className="record-heading"><span className="eyebrow">{current?t("洋流","Current"):ocean?t("海洋","Ocean"):t("潜点","Dive site")}</span>
  <h1>{name(item)}</h1>
  {current&&<div className="tagrow"><span className="tag">{text(current.kind)}</span><span className="tag">{text(current.flow)}</span></div>}
  {ocean&&<p>{text(ocean.etymology)}</p>}</header>
  {cond&&<div className="notice"><strong>{t("模拟流况","Simulated flow")}: {text(cond.level)}</strong><p>{cond.speed.toFixed(2)} m/s · {cond.dir.toFixed(0)}°</p></div>}
  <dl className="dossier__rows">{rows.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{text(v)}</dd></div>)}</dl>
  {sections.map(([title,value])=><section className="dossier__section" key={title}><h3>{title}</h3>{Array.isArray(value)?<ul>{value.map(v=><li key={v}>{text(v)}</li>)}</ul>:<p>{text(value)}</p>}</section>)}
  {current&&<section><h3>{t("关联物种","Linked species")}</h3><div className="tagrow">{current.species.map(id=>{const sp=SPECIES.find(s=>s.id===id);return sp&&<button className="tag" key={id} onClick={()=>select({kind:"species",id})}>{name(sp)}</button>;})}</div></section>}
  {ocean&&<section><h3>{t("海水成分（每千克）","Seawater composition (per kg)")}</h3><table><tbody>{SEAWATER.map(s=><tr key={s.ion}><td>{text(s.ion)}</td><td>{s.g} g</td><td>{s.pct}%</td></tr>)}</tbody></table></section>}
  {dive&&<p className="panel__hint">{t("流况来自模拟场；水温和能见度为季节参考，并非实时观测。","Flow is sampled from a simulated field. Temperature and visibility are seasonal references, not live observations.")}</p>}
  {(current||ocean)&&<ScienceReading kind={current?"currents":"earth"} compact/>}
  <footer className="sources">{t("来源","Source")} · {text(item.source)}</footer>
 </article>;
}
