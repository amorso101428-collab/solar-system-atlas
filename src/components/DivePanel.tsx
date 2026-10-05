import { useAtlas } from "../state/store";
import { DIVE_SITES } from "../data/divesites";
import { useLanguage } from "../i18n";
export default function DivePanel(){
 const {t,name,text}=useLanguage();const select=useAtlas(s=>s.select),focus=useAtlas(s=>s.focusOn);
 return <div><p className="panel__hint">{t("14 个参考潜区。选择潜点查看档案与模拟流况。","14 reference dive regions. Select a site for its dossier and simulated flow.")}</p>
 <div className="catalog-list">{DIVE_SITES.map(s=><button key={s.id} onClick={()=>{select({kind:"dive",id:s.id});focus(s.lon,s.lat);}}><span>{name(s)}<small>{text(s.country)} · {text(s.baseFlow)}</small></span><span aria-hidden>↗</span></button>)}</div>
 <div className="notice">{t("水温、能见度和季节为资料参考区间，非实时观测。","Temperature, visibility and seasons are catalog references, not live observations.")}</div></div>;
}
