import { useEffect, useState } from "react";
import Intro from "./components/Intro";
import { clearEarthTextures } from "./components/globe/Earth";
import GlobeScene from "./components/earth/GeospatialEarth";


import Hud from "./components/Hud";
import { UIParticles } from "./components/UIParticles";
import { AtlasCursor } from "./components/AtlasCursor";
import SceneBoundary from "./components/SceneBoundary";
import { useLanguage } from "./i18n";
import type { CurrentField } from "./lib/currentField";
import { makeFallbackField, loadWaterMask, attachMask, loadPublishedField, toMs, FieldLoadError } from "./lib/fieldSource";
import { detectQuality, qualityOverride } from "./lib/quality";
import { Arrival } from "./components/Arrival";
import { useAtlas } from "./state/store";
import { useUIMotion } from "./state/uiMotion";

export default function App() {
  const view = useAtlas((s) => s.view);
  const setView = useAtlas((s) => s.setView);
  const quality = useAtlas((s) => s.quality);

  const entered = view !== "INTRO";
  const panel = useAtlas(s => s.panel);
  const { t, locale } = useLanguage();
  const [sceneAttempt, setSceneAttempt] = useState(0);
  useEffect(() => { document.documentElement.lang=locale; document.title=t("HUMAN ARTIFACTS · 地球知识", "HUMAN ARTIFACTS · Earth knowledge"); }, [locale, t]);
  const [field, setField] = useState<CurrentField | null>(null);

  // deep links: ?view=globe|map|depth  &intro=0
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lang=p.get("lang");if(lang==="en"||lang==="zh")useAtlas.getState().setLocale(lang==="en"?"en":"zh-CN");
    if(p.get("from")==="solar"){useAtlas.getState().setPlaying(false);const lon=Number(p.get("lon")),lat=Number(p.get("lat"));if(p.has("lon")&&p.has("lat")&&Number.isFinite(lon)&&Number.isFinite(lat))useAtlas.getState().focusOn(lon,lat);}
    const v = (p.get("view") || "").toUpperCase();
    if (v === "MAP" || v === "DEPTH" || v === "GLOBE") setView(v as any);
    if (p.get("intro") === "0" && !v) setView("GLOBE");
    const mo = (p.get("mode") || "").toUpperCase();
    if (mo === "GEOGRAPHY" || mo === "DIVE" || mo === "EXPLORE") useAtlas.getState().setMode(mo as any);
    const lesson = p.get("lesson");
    if (lesson) useAtlas.getState().setLesson(lesson);
    const step = p.get("step");
    if (step) useAtlas.getState().setLessonStep(Number(step));
    const sel = p.get("sel");
    if (sel && sel.includes(":")) {
      const [kind, id] = sel.split(":");
      if (kind === "current" || kind === "ocean" || kind === "species" || kind === "dive") {
        useAtlas.getState().select({ kind: kind as any, id });
      }
    }
  }, [setView]);
  const [scale, setScale] = useState("GLOBAL");
  useEffect(() => {
    const sync=()=>{
      const el=document.querySelector<HTMLElement>('.atlas[data-view]');if(!el)return;
      const height=window.visualViewport?.height??window.innerHeight;
      el.style.setProperty('--app-height',`${Math.round(height)}px`);
      el.style.setProperty('--vv-offset-top',`${Math.round(window.visualViewport?.offsetTop??0)}px`);
      el.dataset.keyboard=window.innerHeight-height>120?'open':'closed';
    };
    sync();window.addEventListener('resize',sync);window.visualViewport?.addEventListener('resize',sync);window.visualViewport?.addEventListener('scroll',sync);
    return()=>{window.removeEventListener('resize',sync);window.visualViewport?.removeEventListener('resize',sync);window.visualViewport?.removeEventListener('scroll',sync);};
  }, []);

  const reloadRequest = useAtlas((s) => s.reloadRequest);

  // pick a render tier from the device (plan §17)
  useEffect(() => {
    useAtlas.getState().setQuality(qualityOverride() ?? detectQuality());
  }, []);

  // field bootstrap: analytic fallback paints immediately, then a published
  // feed replaces it if one is wired up (plan §18 fallback contract)
  useEffect(() => {
    let cancelled = false,publishedReady=false;
    const store = useAtlas.getState();

    const fallback = makeFallbackField();
    setField(fallback);
    store.setFieldData(fallback);

    loadWaterMask().then((img) => {
      if (cancelled || publishedReady) return;
      attachMask(fallback, img);
      setField({ ...fallback });
      useAtlas.getState().setFieldData({ ...fallback });
    });

    const p = new URLSearchParams(window.location.search);
    if (p.get("field") === "off" || p.get("fieldFail") === "1") {
      store.setDataHealth("UNAVAILABLE", "Published field disabled for this session");
      return () => { cancelled = true; };
    }

    const load=()=>loadPublishedField(p.get("field") || "/current/manifest.json")
      .then(({ field: published, manifest }) => {
        if (cancelled) return;
        const s = useAtlas.getState();
        if(publishedReady&&published.timestamp<=s.field.timestamp)return;
        publishedReady=true;
        setField(published);
        s.setFieldData(published);
        const validT = toMs(manifest.timestamp);
        s.setFieldInfo({
          source: String(manifest.source || "PUBLISHED FIELD").toUpperCase(),
          mode: manifest.mode || "ANALYSIS",
          timestamp: validT,
          updatedAt: toMs(manifest.updatedAt, validT),
          simulated: manifest.simulated ?? false,
          status: "LIVE",
          resolution: manifest.resolution || "unknown",
        });
        s.setDataHealth("OK");
      })
      .catch((e) => {
        if (cancelled) return;
        // a missing manifest just means no feed is wired yet — stay quiet and
        // keep the analytic fallback; a broken feed is surfaced as DEGRADED.
        if (e instanceof FieldLoadError && e.stage === "field") {
          useAtlas.getState().setDataHealth("DEGRADED", "Manifest found but the field binary failed to load");
        }
      });

    load();
    const refresh=setInterval(()=>{if(!document.hidden)load();},1800000);
    return () => { cancelled = true;clearInterval(refresh); };
  }, [reloadRequest]);

  // Wall clock follows China display time; manual selection explicitly enters replay.
  useEffect(() => {
    let last=Date.now();
    const tick=()=>{const now=Date.now();useAtlas.getState().tickTime(now,now-last);last=now;};
    const id=setInterval(tick,1000);document.addEventListener('visibilitychange',tick);
    return()=>{clearInterval(id);document.removeEventListener('visibilitychange',tick);};
  }, []);

  const noWebGL=new URLSearchParams(location.search).get("webgl")==="off";
  const showGlobe = !!field && (view === "GLOBE");

  const globeFallback=<div className="scene-error" role="alert"><h2>{t("三维地球暂不可用", "3D globe unavailable")}</h2><p>{t("可重试，或从资料库继续阅读海洋与生物档案。", "Retry, or continue reading ocean and species records in the library.")}</p><button onClick={() => {clearEarthTextures();setSceneAttempt(x => x + 1);}}>{t("重试", "Retry")}</button><button onClick={() => useAtlas.getState().setPanel("library")}>{t("打开资料库", "Open library")}</button></div>;

  return (
    <div data-ui-system="shared" data-ui-preview="heritage" data-ui-motion={useUIMotion(s=>s.mode)} data-view={view} data-reduced={useAtlas(s=>s.reducedMotion)} className={"atlas" + (entered && panel ? " has-overlay" : "") + (!entered ? " is-intro" : "")}>
      <AtlasCursor />
      <UIParticles disabled={useAtlas(s=>s.reducedMotion)} />
      <div className="canvas-layer" key={view}>
        {showGlobe && field && (
          <SceneBoundary key={sceneAttempt} fallback={globeFallback}>{noWebGL?globeFallback:<GlobeScene field={field} quality={quality} onDescend={() => {}} onScale={setScale} />}</SceneBoundary>
        )}


        {!field && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span>{t("正在准备海洋数据…", "Preparing ocean data…")}</span>
          </div>
        )}
      </div>

      <Arrival/>
      {entered && <Hud scale={scale} />}
      {!entered && <Intro onEnter={() => setView("GLOBE")} />}
    </div>
  );
}
