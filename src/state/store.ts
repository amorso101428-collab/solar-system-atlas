import { create } from "zustand";
import type { CurrentField } from "../lib/currentField";
import { DEFAULT_LAYERS } from "../lib/layerRegistry";

export type Mode = "EXPLORE" | "GEOGRAPHY" | "DIVE";
export type View = "INTRO" | "GLOBE" | "MAP" | "DEPTH";
export type Monsoon = "OFF" | "SUMMER" | "WINTER" | "COMPARE";
export type Locale = "zh-CN" | "en";
export type Overlay = "view" | "layers" | "tools" | "search" | "music" | "help" | "time" | null;
export type Panel = "layers" | "library" | "learn" | "dive" | "status" | "weather" | "winds" | "dossier" | "profile" | "sky" | "earth" | null;

/** Layer ids are owned by src/lib/layerRegistry.ts */
export type LayerKey = string;

export interface FieldState {
  source: string;
  mode: string;
  timestamp: number;
  updatedAt: number;
  latencyMin: number;
  status: "LIVE" | "DELAYED" | "STALE" | "SIMULATED";
  resolution: string;
  simulated: boolean;
}

export interface TimeState {
  simTime: number;
  followNow: boolean;
  playing: boolean;
  rate: number;
  span: "past24h" | "past72h" | "future24h" | "future10d";
}

export interface Selection { kind: "current" | "ocean" | "species" | "dive" | null; id: string | null; }

interface AtlasState {
  denmarkMusic:boolean;
  setDenmarkMusic:(value:boolean)=>void;
  cloudPreference:boolean;
  setAnalysis:(kind:"natural"|"currents"|"wind"|"rain")=>void;
  windFocus:string|null;
  inspectWind:(id:string|null)=>void;
  cameraAction: {kind:"in"|"out"|"home";key:number}|null;
  requestCamera: (kind:"in"|"out"|"home")=>void;
  dossierHistory: Selection[];
  backDossier: ()=>void;
  libraryQuery: string;
  libraryTab: "current" | "species" | "ocean";
  setLibrary: (value: {libraryQuery?: string; libraryTab?: "current" | "species" | "ocean"}) => void;
  locale: Locale;
  setLocale: (locale: Locale) => void;
  overlay: Overlay;
  setOverlay: (overlay: Overlay) => void;
  closeUi: () => void;
  panel: Panel;
  previousPanel: Panel;
  setPanel: (panel: Panel) => void;
  savedLayers: Record<string, boolean> | null;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
  view: View;
  mode: Mode;
  layers: Record<string, boolean>;
  field: FieldState;
  time: TimeState;
  selection: Selection;
  hover: { label: string; sub: string; x: number; y: number } | null;
  quality: "HIGH" | "MEDIUM" | "LOW";
  dossierOpen: boolean;
  monsoon: Monsoon;
  lessonId: string;
  lessonStep: number;
  /** the live CurrentField, so DIVE/GEOGRAPHY panels can sample it */
  fieldData: CurrentField | null;
  setFieldData: (f: CurrentField) => void;
  /** plan §18 — degraded / offline contract for the current field */
  dataHealth: "OK" | "DEGRADED" | "UNAVAILABLE";
  dataNote: string | null;
  setDataHealth: (h: "OK" | "DEGRADED" | "UNAVAILABLE", note?: string | null) => void;
  setFieldInfo: (i: Partial<FieldState>) => void;
  reloadRequest: number;
  requestReload: () => void;
  /** camera fly-to request; key forces a re-trigger on repeat selections */
  focus: { lon: number; lat: number; key: number } | null;
  focusOn: (lon: number, lat: number) => void;
  setView: (v: View) => void;
  setMode: (m: Mode) => void;
  toggleLayer: (k: LayerKey) => void;
  select: (s: Selection) => void;
  closeDossier: () => void;
  setHover: (h: AtlasState["hover"]) => void;
  setPlaying: (p: boolean) => void;
  setRate: (r: number) => void;
  nudgeTime: (ms: number) => void;
  setSimTime: (t: number) => void;
  followCurrentTime: () => void;
  tickTime: (now: number, elapsed: number) => void;
  setSpan: (s: TimeState["span"]) => void;
  setQuality: (q: AtlasState["quality"]) => void;
  setMonsoon: (m: Monsoon) => void;
  setLesson: (id: string) => void;
  setLessonStep: (n: number) => void;
}

const now = Date.now();
const validT = Math.floor(now / 3600000) * 3600000;

function initialLocale(): Locale {
  try { return localStorage.getItem("atlas.locale") === "en" ? "en" : "zh-CN"; } catch { return "zh-CN"; }
}
export const useAtlas = create<AtlasState>((set, get) => ({
  denmarkMusic:false,setDenmarkMusic:(denmarkMusic)=>set({denmarkMusic}),
  cameraAction:null,requestCamera:(kind)=>set({cameraAction:{kind,key:Date.now()}}),
  dossierHistory:[],backDossier:()=>set(s=>s.dossierHistory.length?{selection:s.dossierHistory[s.dossierHistory.length-1],dossierHistory:s.dossierHistory.slice(0,-1)}:{panel:s.previousPanel,dossierOpen:false}),
  libraryQuery: "", libraryTab: "current", setLibrary: (value) => set(value),
  locale: initialLocale(),
  setLocale: (locale) => { try { localStorage.setItem("atlas.locale", locale); } catch {} set({ locale }); },
  overlay: null,
  setOverlay: (overlay) => {
    if (get().overlay === overlay) return;
    if (overlay && get().panel !== null) get().setPanel(null);
    set({overlay});
  },
  closeUi: () => get().setPanel(null),
  panel: null,
  previousPanel: null,
  savedLayers: null,
  reducedMotion: typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setPanel: (panel) => {
    const mode = panel === "learn" ? "GEOGRAPHY" : panel === "dive" ? "DIVE" : "EXPLORE";
    get().setMode(mode);
    set({ panel, overlay: null, dossierOpen: panel === "dossier", hover: null });
  },
  cloudPreference:true,
  windFocus:null,inspectWind:(windFocus)=>{get().setPanel('winds');set({windFocus});},
  setAnalysis:(kind)=>set(s=>({view:"GLOBE",time:{...s.time,playing:kind==="currents"},layers:{...s.layers,currents:kind==="currents",wind:kind==="wind",rain:kind==="rain",field:false,warmcold:false,relief:false,windbelts:false,cloudcover:false,clouds:kind==="natural"?s.cloudPreference:false}})),
  view: "INTRO",
  mode: "EXPLORE",
  layers: { ...DEFAULT_LAYERS },
  field: {
    source: "OCEAN ATLAS ANALYTIC FIELD",
    mode: "FALLBACK / SYNTHETIC",
    timestamp: validT,
    updatedAt: now,
    latencyMin: 0,
    status: "SIMULATED",
    resolution: "0.5deg",
    simulated: true,
  },
  time: { simTime: now, followNow: true, playing: false, rate: 1, span: "past24h" },
  selection: { kind: null, id: null },
  hover: null,
  quality: "HIGH",
  dossierOpen: false,
  monsoon: "SUMMER",
  lessonId: "gyre",
  lessonStep: 0,
  fieldData: null,
  setFieldData: (fieldData) => set({ fieldData }),
  dataHealth: "OK",
  dataNote: null,
  setDataHealth: (dataHealth, dataNote = null) => set({ dataHealth, dataNote }),
  setFieldInfo: (i) => set((s) => ({ field: { ...s.field, ...i } })),
  reloadRequest: 0,
  requestReload: () => set((s) => ({ reloadRequest: s.reloadRequest + 1 })),
  focus: null,
  focusOn: (lon, lat) => set({ focus: { lon, lat, key: Date.now() } }),
  setView:(view)=>{if(view==="MAP"){get().setAnalysis("currents");return;}if(view==="DEPTH"){set({view:"GLOBE"});get().setPanel("profile");return;}set({view});},
  setMode: (mode) => set((s) => {
    if (mode === s.mode) return {};
    const base = s.savedLayers ?? s.layers;
    return { mode, savedLayers: mode === "EXPLORE" ? null : { ...base },
      layers: mode === "GEOGRAPHY" ? { ...base, currents: true, wind: false, windbelts: true, warmcold: true, labels: true, clouds:false }
        : mode === "DIVE" ? { ...base, divesites: true, labels: true } : { ...base },
      panel: mode === "GEOGRAPHY" ? "learn" : mode === "DIVE" ? "dive" : s.panel,
    };
  }),
  toggleLayer:(k)=>set(s=>{const layers={...s.layers,[k]:!s.layers[k]};const analysis=["currents","wind","rain","cloudcover","field","warmcold","relief"].some(id=>layers[id]);const cloudPreference=k==="clouds"?!s.cloudPreference:s.cloudPreference;if(layers[k]&&["wind","rain","cloudcover","field","warmcold","relief"].includes(k))for(const id of ["wind","rain","cloudcover","field","warmcold","relief"]){if(id!==k)layers[id]=false;}if(layers[k]&&["wind","rain","cloudcover"].includes(k))layers.currents=false;if(k==="currents"&&layers.currents){layers.wind=false;layers.rain=false;layers.cloudcover=false;}layers.clouds=analysis?false:cloudPreference;return {layers,cloudPreference,time:["currents","wind","rain","cloudcover"].includes(k)?{...s.time,playing:layers.currents}:s.time};}),
  select: (selection) => set((s) => ({ selection, overlay: null, dossierOpen: selection.kind !== null,
    previousPanel: s.panel === "dossier" ? s.previousPanel : s.panel,
    dossierHistory:s.panel === "dossier" && s.selection.kind && s.selection.id!==selection.id ? [...s.dossierHistory,s.selection] : [],
    panel: selection.kind ? "dossier" : s.previousPanel, hover: null })),
  closeDossier: () => set((s) => ({ panel: s.previousPanel, dossierOpen: false, dossierHistory:[],hover: null })),
  setHover: (hover) => set({ hover }),
  setPlaying: (playing) => set((s) => ({ time: { ...s.time, playing } })),
  setRate: (rate) => set((s) => ({ time: { ...s.time, rate } })),
  setSimTime: (t) => set((s) => ({ time: { ...s.time, simTime: t, followNow: false } })),
  followCurrentTime: () => set(s=>({time:{...s.time,simTime:Date.now(),followNow:true}})),
  tickTime: (now,elapsed) => set(s=>s.time.followNow?{time:{...s.time,simTime:now}}:s.time.playing?{time:{...s.time,simTime:s.time.simTime+Math.max(0,Math.min(elapsed,5000))*s.time.rate}}:{}),
  setSpan: (span) => set((s) => ({ time: { ...s.time, span } })),
  nudgeTime: (ms) => set((s) => ({ time: { ...s.time, simTime: s.time.simTime + ms, followNow: false } })),
  setQuality: (quality) => set({ quality }),
  setMonsoon: (monsoon) => set({ monsoon }),
  setLesson: (lessonId) => set({ lessonId, lessonStep: 0 }),
  setLessonStep: (lessonStep) => set({ lessonStep }),
}));
