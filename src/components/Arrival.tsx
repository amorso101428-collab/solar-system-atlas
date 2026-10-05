import {useEffect,useState} from "react";
import {useAtlas} from "../state/store";
import {useLanguage} from "../i18n";
export function Arrival(){const {t}=useLanguage(),reduced=useAtlas(s=>s.reducedMotion);const [active,setActive]=useState(()=>new URLSearchParams(location.search).get("handoff")==="1");
 useEffect(()=>{if(!active)return;const id=setTimeout(()=>{setActive(false);const url=new URL(location.href);url.searchParams.delete("handoff");history.replaceState(null,"",url);},reduced?100:1500);return()=>clearTimeout(id);},[active,reduced]);
 return active?<div className="ocean-arrival" role="status"><span>{t("地球 / 海洋","EARTH / OCEAN")}</span><p>{t("一颗星球，五片海洋","ONE PLANET. FIVE OCEANS.")}</p></div>:null;
}
