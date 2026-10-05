import { useCallback, useState, useEffect, useRef } from "react";
import Underwater from "./Underwater";
import { LanguageSwitch } from "./Hud";
import { useLanguage } from "../i18n";
import { useAtlas } from "../state/store";
export default function Intro({onEnter}:{onEnter:()=>void}){
 const {t}=useLanguage();const [failed,setFailed]=useState(false),[retry,setRetry]=useState(0);const fail=useCallback((error:Error)=>{ console.error("Underwater scene:",error);setFailed(true);},[]);
 const [entering,setEntering]=useState(false),timer=useRef<ReturnType<typeof setTimeout>>();
 useEffect(()=>()=>clearTimeout(timer.current),[]);
 const enter=()=>{if(entering)return;if(useAtlas.getState().reducedMotion){onEnter();return;}setEntering(true);timer.current=setTimeout(onEnter,700);};
 const reduced=useAtlas(s=>s.reducedMotion),setReduced=useAtlas(s=>s.setReducedMotion);
 return <section className={"intro"+(entering?" is-departing":"")} aria-label={t("海洋图谱首页","Ocean Atlas home")}>
  <div className="underwater-fallback deep-fallback" aria-hidden="true"/>
  {!failed&&<Underwater key={retry} onError={fail}/>}
  <header className="intro-header"><span className="intro-wordmark">{t("海洋图谱","Ocean Atlas")}</span><LanguageSwitch/></header>
  <div className="intro-copy">
   <span className="eyebrow">{t("微光之下，海洋如宇宙","A universe beneath the light")}</span>
   <h1>{t("向海洋深处","Into the ocean")}</h1>
   <p className="intro-lede">{t("在深海仰望，\n看见另一片星空。","Look up from the deep\ninto another constellation.")}</p>
   <p className="intro-description">{t("探索五大洋的环流、地形与生命。旋转地球，沿洋流前行，抵达 11,000 米的深渊。","Explore the circulation, landscapes and life of five oceans. Turn the Earth, follow its currents and descend into the 11,000-metre abyss.")}</p>
   <button className="intro-cta" onClick={enter}>{t("进入海洋图谱","Explore the atlas")} <span aria-hidden>↗</span></button>
   <div className="intro-caption">{t("拖动旋转 · 点击探索","Drag to rotate · Select to discover")}</div>
  </div>
  <footer className="intro-footer"><span>© 2026 {t("海洋图谱","Ocean Atlas")}</span><label><input type="checkbox" role="switch" checked={reduced} onChange={e=>setReduced(e.target.checked)}/>{t("减少动态效果","Reduce motion")}</label><button onClick={enter}>{t("跳过开场","Skip intro")} →</button></footer>
  {failed&&<div className="intro-error" role="status">{t("实时场景暂不可用，已显示静态背景。","Live scene unavailable. Showing a still background.")}<button onClick={()=>{setFailed(false);setRetry(retry+1);}}>{t("重试","Retry")}</button></div>}
 </section>;
}
