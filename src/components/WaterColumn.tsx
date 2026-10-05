import { useState } from "react";
import { DEPTH_ZONES } from "../data/oceans";
import { SPECIES } from "../data/species";
import { useAtlas } from "../state/store";
import { useLanguage } from "../i18n";
export const PROFILE=[{d:0,t:22,s:35},{d:200,t:15,s:35.3},{d:1000,t:4.5,s:34.7},{d:4000,t:1.8,s:34.8},{d:6000,t:1.5,s:34.8},{d:11000,t:2.3,s:34.9}];
export function profileAt(d:number){d=Math.max(0,Math.min(11000,Number.isFinite(d)?d:0));const b=PROFILE.findIndex(p=>p.d>=d);if(b<=0)return PROFILE[0];const a=PROFILE[b-1],c=PROFILE[b],f=(d-a.d)/(c.d-a.d);return {d,t:a.t+(c.t-a.t)*f,s:a.s+(c.s-a.s)*f};}
const y=(d:number)=>38+d/11000*300;
export default function WaterColumn(){
 const {t,text,name,locale}=useLanguage();const select=useAtlas(s=>s.select);const [depth,setDepth]=useState(1000),[metric,setMetric]=useState<"t"|"s">("t");
 const inZone=(from:number,to:number)=>depth>=from&&(depth<to||to===11000);
 const p=profileAt(depth),x=(v:number)=>50+(metric==="t"?v/25:(v-34.5))*220;
 const ticks=metric==="t"?[0,5,10,15,20,25]:[34.5,34.7,34.9,35.1,35.3,35.5];
 return <div className="depth-layout"><main>
  <div className="depth-heading"><span className="eyebrow">0 — 11,000 m</span><h1>{t("深海剖面","Ocean depth profile")}</h1><p>{t("选择水层了解光照、压力与生命；剖面曲线展示温盐随深度的变化。","Select a zone to explore light, pressure and life. The profile chart traces temperature and salinity with depth.")}</p></div>
  {DEPTH_ZONES.map((z,i)=><section className={"depth-zone"+(inZone(z.from,z.to)?" is-selected":"")} key={z.id} style={{background:`linear-gradient(110deg, rgba(22,${65-i*8},${83-i*10},.6),rgba(3,12,20,.8))`}}>
   <button className="zone-heading" onClick={()=>setDepth(z.from)} aria-pressed={inZone(z.from,z.to)}><h2>{locale==="en"?text(z.cn):z.cn}</h2><span>{z.from.toLocaleString()}–{z.to.toLocaleString()} m <i aria-hidden>↗</i></span></button>
   <div className="zone-facts"><span>{t("温度","Temperature")}: {z.temp}</span><span>{text(z.light)}</span><span>≈ {(1+z.from/10).toFixed(0)}–{(1+z.to/10).toFixed(0)} atm</span></div>
   <p>{text(z.life)}</p>{inZone(z.from,z.to)&&<div className="tagrow">{SPECIES.filter(s=>{const m=s.depth.match(/(\d+)–(\d+)/);return m&&Number(m[1])<z.to&&Number(m[2])>z.from;}).map(s=><button className="tag" key={s.id} onClick={()=>select({kind:"species",id:s.id})}><i className="species-dot" style={{background:s.color}}/>{name(s)} <span aria-hidden>›</span></button>)}</div>}
  </section>)}
 </main><aside className="profile-panel"><h2>{t("温盐剖面","Temperature & salinity")}</h2>
 <div className="tagrow">{(["t","s"] as const).map(k=><button key={k} className={metric===k?"tag is-on":"tag"} aria-pressed={metric===k} onClick={()=>setMetric(k)}>{k==="t"?t("温度 °C","Temperature °C"):t("盐度 PSU","Salinity PSU")}</button>)}</div>
 <svg viewBox="0 0 300 370" role="img" aria-label={t("线性深度坐标；点击图表选取深度","Linear depth axis. Select the chart to inspect depth")} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();setDepth(Math.round(Math.max(0,Math.min(11000,((e.clientY-r.top)/r.height*370-38)/300*11000))));}}>
  <text x="5" y="18" fill="#a49a87" fontSize="13">{t("深度 m","Depth m")}</text>
  {ticks.map(v=><g key={v}><line x1={x(v)} x2={x(v)} y1="38" y2="338" stroke="#38352d"/><text x={x(v)} y="30" textAnchor="middle" fill="#ccc2af" fontSize="13">{v}</text></g>)}
  {[0,2000,4000,6000,8000,10000,11000].map(d=><g key={d}><line x1="50" x2="270" y1={y(d)} y2={y(d)} stroke="#38352d"/><text x="44" y={y(d)+4} textAnchor="end" fill="#ccc2af" fontSize="13">{d.toLocaleString()}</text></g>)}
  <path d={PROFILE.map((p,i)=>`${i?"L":"M"} ${x(p[metric])} ${y(p.d)}`).join(" ")} stroke={metric==="t"?"#d5ad69":"#71bac7"} fill="none" strokeWidth="2.5"/>
  {PROFILE.map(p=><circle key={p.d} cx={x(p[metric])} cy={y(p.d)} r="3" fill={metric==="t"?"#d5ad69":"#71bac7"}/>)}
  <line x1="50" x2="270" y1={y(depth)} y2={y(depth)} stroke="#e2edf0" strokeDasharray="3 3"/><circle cx={x(p[metric])} cy={y(depth)} r="5" fill="#edf0eb"/>
  <text x="160" y="363" textAnchor="middle" fill="#a49a87" fontSize="13">{metric==="t"?t("温度（°C）","Temperature (°C)"):t("盐度（PSU）","Salinity (PSU)")}</text>
 </svg>
 <label className="depth-slider">{t("选取深度","Inspect depth")}<input type="range" min="0" max="11000" step="10" value={depth} onChange={e=>setDepth(Number(e.target.value))}/></label>
 <div className="profile-reading"><strong>{depth.toLocaleString()} m</strong><span>{p.t.toFixed(1)} °C · {p.s.toFixed(2)} PSU</span></div>
 <p className="panel__hint">{t("示意剖面，非全球平均实测。深度为线性刻度；物种可跨越多个水层。点击物种打开摄影与分类档案。","Illustrative profile, not a measured global average. Depth uses a linear scale. Species may occupy several zones. Select one to see photographs and taxonomy.")}</p></aside></div>;
}
