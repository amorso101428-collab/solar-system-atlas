import ScienceReading from "./ScienceReading";
import { useAtlas } from "../state/store";
import { LESSONS } from "../data/lessons";
import { useLanguage } from "../i18n";
export default function GeographyPanel(){
 const view=useAtlas(s=>s.view);
 const {t,text,locale}=useLanguage();const id=useAtlas(s=>s.lessonId),step=useAtlas(s=>s.lessonStep),setLesson=useAtlas(s=>s.setLesson),setStep=useAtlas(s=>s.setLessonStep),monsoon=useAtlas(s=>s.monsoon),setMonsoon=useAtlas(s=>s.setMonsoon),layers=useAtlas(s=>s.layers),toggle=useAtlas(s=>s.toggleLayer);
 const lesson=LESSONS.find(l=>l.id===id)??LESSONS[0];const current=lesson.steps[Math.min(step,lesson.steps.length-1)];
 return <article className="explore-paths">
  <section className="explore-step-card"><label className="search-label">{t("选择探索主题","Choose an exploration")}<select value={lesson.id} onChange={e=>setLesson(e.target.value)}>{LESSONS.map(l=><option key={l.id} value={l.id}>{locale==="en"?l.title_en:l.title_cn}</option>)}</select></label>
  <div className="lesson-progress">{t("步骤","Step")} {step+1} / {lesson.steps.length}</div>
  <h3>{locale==="en"?current.label:current.cn}</h3><p>{text(current.detail)}</p>
  <div className="tagrow"><button className="tag" disabled={step===0} onClick={()=>setStep(step-1)}>{t("上一步","Previous")}</button><button className="tag" disabled={step>=lesson.steps.length-1} onClick={()=>setStep(step+1)}>{t("下一步","Next")}</button><button className="tag" onClick={()=>setStep(0)}>{t("重置","Reset")}</button></div>
  </section><ol className="lesson-steps">{lesson.steps.map((s,i)=><li key={s.label}><button aria-current={i===step?"step":undefined} onClick={()=>setStep(i)}>{i+1}. {locale==="en"?s.label:s.cn}</button></li>)}</ol>
  <div className="notice">{text(lesson.question)}</div>
  {view!=="GLOBE"&&<p className="panel__hint">{t("风带示意在地球视图中显示。","Wind diagrams are available in the globe view.")}</p>}
  <section className="explore-phase-card"><h3>{t("季风相位","Monsoon phase")}</h3><div className="tagrow">{(["SUMMER","WINTER","COMPARE"] as const).map(m=><button className={monsoon===m?"tag is-on":"tag"} key={m} aria-pressed={monsoon===m} onClick={()=>setMonsoon(m)}>{text(m)}</button>)}</div>
  <p className="panel__hint">{monsoon==="COMPARE"?t("每三秒切换夏季与冬季，观察环流反转。","Summer and winter alternate every three seconds to show the reversal."):monsoon==="SUMMER"?t("西南季风驱动索马里上升流与东北向流。","The southwest monsoon drives Somali upwelling and northeastward flow."):t("东北季风使北印度洋环流反转。","The northeast monsoon reverses northern Indian Ocean circulation.")}</p>
  </section><div className="legend"><p><i style={{background:"#f29e4f"}}/>{t("暖流","Warm current")}</p><p><i style={{background:"#21a2d6"}}/>{t("寒流","Cold current")}</p><p><i style={{background:"#c58a55"}}/>{t("风带（示意）","Wind belts (schematic)")}</p></div>
  <div className="tagrow"><button className={layers.windbelts?"tag is-on":"tag"} disabled={view!=="GLOBE"} onClick={()=>toggle("windbelts")}>{t("环流带示意","Circulation belts")}</button><button className={layers.currents?"tag is-on":"tag"} disabled={view==="DEPTH"} onClick={()=>toggle("currents")}>{t("洋流","Currents")}</button><button className={layers.warmcold?"tag is-on":"tag"} disabled={view==="DEPTH"} onClick={()=>toggle("warmcold")}>{t("寒暖着色","Warm / cold colors")}</button></div>
  <p className="panel__hint">{t("退出探索路径后恢复你的图层设置。","Your layer settings are restored when you leave exploration paths.")}</p>
 <ScienceReading kind="currents" compact/>
 </article>;
}
