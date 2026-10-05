import { useEffect, useMemo, useRef } from "react";
import { loadLand, eachRing } from "../lib/geo";
import { sampleUV, isWater, type CurrentField } from "../lib/currentField";
import { pickCurrent, pickOcean } from "../lib/pick";
import { useAtlas } from "../state/store";
import { useWeather } from "../lib/weather";
import { OCEANS } from "../data/oceans";
import { translate, useLanguage } from "../i18n";
import { DIVE_SITES } from "../data/divesites";

const DEG = Math.PI / 180;

export default function OceanMap({ field }: { field: CurrentField }) {
  const {t}=useLanguage();const focus=useAtlas(s=>s.focus);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef({ zoom: 1, lon: 0, lat: 6 });
  useEffect(()=>{if(focus){view.current.lon=focus.lon;view.current.lat=focus.lat;}},[focus?.key]);
  const drag = useRef<{ x: number; y: number; lon: number; lat: number } | null>(null);
  const landRef = useRef<any[]>([]);
  const baseImage=useRef<HTMLImageElement|null>(null);
  useEffect(()=>{const image=new Image();image.onload=()=>{baseImage.current=image;};image.src="/earth/earth-land.jpg";return()=>{image.onload=null;};},[]);
  const hoverRef = useRef<{ lo: number; la: number } | null>(null);

  useEffect(() => { loadLand().then((f) => { landRef.current = f; }).catch(()=>{landRef.current=[];}); }, []);

  // pre-render the velocity magnitude field as a colour layer
  const speedCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = field.width; c.height = field.height;
    const cx = c.getContext("2d")!;
    const img = cx.createImageData(field.width, field.height);
    for (let k = 0; k < field.width * field.height; k++) {
      const s = Math.min(1, field.speed[k]);
      let r: number, g: number, b: number;
      if (s < 0.5) { const t = s * 2; r = 8 + t * 45; g = 78 + t * 95; b = 100 + t * 84; }
      else { const t = (s - 0.5) * 2; r = 53 + t * 150; g = 173 - t * 28; b = 184 - t * 92; }
      const a = field.ocean[k] ? Math.pow(s, 2.5) * 200 : 0;
      const p = k * 4;
      img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = a;
    }
    cx.putImageData(img, 0, 0);
    return c;
  }, [field]);

  // warm/cold provenance layer used by GEOGRAPHY mode
  const warmCanvas = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = field.width; c.height = field.height;
    const cx = c.getContext("2d")!;
    const img = cx.createImageData(field.width, field.height);
    for (let k = 0; k < field.width * field.height; k++) {
      const w = field.warm[k];
      const s = Math.min(1, field.speed[k]);
      let r: number, g: number, b: number;
      if (w >= 0) { r = 33 + (242 - 33) * w; g = 162 + (158 - 162) * w; b = 214 + (74 - 214) * w; }
      else { const a = -w; r = 33; g = 162 + (130 - 162) * a; b = 214 + (200 - 214) * a; }
      const alpha = field.ocean[k] ? Math.abs(w) * 235 * (0.30 + 0.70 * s) : 0;
      const p = k * 4;
      img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = alpha;
    }
    cx.putImageData(img, 0, 0);
    return c;
  }, [field]);

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d")!;
    const setHover = useAtlas.getState().setHover;
    const select = useAtlas.getState().select;

    const N = 5200;
    const lon = new Float32Array(N), lat = new Float32Array(N);
    const uu = new Float32Array(N), vv = new Float32Array(N), spd = new Float32Array(N);
    const seed = (): [number, number] => {
      let lo = 0, la = 0;
      for (let t = 0; t < 60; t++) {
        lo = Math.random() * 360 - 180; la = (Math.random() * 2 - 1) * 82;
        if (!isWater(field, lo, la)) continue;
        const [u, v] = sampleUV(field, lo, la);
        if (Math.random() < Math.max(0.05, Math.hypot(u, v))) return [lo, la];
      }
      return [lo, la];
    };
    for (let i = 0; i < N; i++) {
      const [lo, la] = seed();
      lon[i] = lo; lat[i] = la; spd[i] = 0.25;
    }

    let W = 0, H = 0, dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = wrap.clientWidth; H = wrap.clientHeight;
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(wrap);

    const scale = () => Math.min(W / 360, H / 180) * view.current.zoom;
    const zoomNow = () => view.current.zoom;
    const proj = (lo: number, la: number) => {
      const s = scale();
      return [W / 2 + (lo - view.current.lon) * s, H / 2 - (la - view.current.lat) * s] as const;
    };
    const unproj = (x: number, y: number) => {
      const s = scale();
      return [view.current.lon + (x - W / 2) / s, view.current.lat - (y - H / 2) / s] as const;
    };

    const draw = (dt: number) => {
      const st = useAtlas.getState();
      const layers = st.layers;
      const rate = st.reducedMotion || !st.time.playing ? 0 : st.time.rate;
      const geo = st.mode === "GEOGRAPHY";
      const diveMode = st.mode === "DIVE";

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#04111c"); g.addColorStop(0.45, "#03141f"); g.addColorStop(1, "#02070c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      if(baseImage.current){const s=scale();ctx.save();ctx.globalAlpha=.82;
        for(const off of [-360,0,360])ctx.drawImage(baseImage.current,W/2+(-180-view.current.lon+off)*s,H/2-(90-view.current.lat)*s,360*s,180*s);
        ctx.restore();}
      // velocity magnitude layer
      if (layers.field || layers.warmcold) {
        const s = scale();
        const x0 = W / 2 + (-180 - view.current.lon) * s;
        const y0 = H / 2 - (90 - view.current.lat) * s;
        ctx.save();
        ctx.globalAlpha = geo ? 0.55 : 0.55;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(layers.warmcold ? warmCanvas : speedCanvas, x0, y0, 360 * s, 180 * s);
        ctx.restore();
      }

      if (layers.graticule) {
        ctx.strokeStyle = "rgba(214,232,248,.09)"; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let lo = -180; lo <= 180; lo += 30) { const [x] = proj(lo, 0); ctx.moveTo(x, 0); ctx.lineTo(x, H); }
        for (let la = -80; la <= 80; la += 20) { const [, y] = proj(0, la); ctx.moveTo(0, y); ctx.lineTo(W, y); }
        ctx.stroke();
      }

      if (layers.boundaries || !baseImage.current) {
        for (const f of landRef.current) {
          eachRing(f.geometry, (ring) => {
            for (const off of [-360, 0, 360]) {
              ctx.beginPath();
              for (let i = 0; i < ring.length; i++) {
                const [x, y] = proj(ring[i][0] + off, ring[i][1]);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
              }
              ctx.closePath();
              ctx.fillStyle = "#0a1512";
              if(!baseImage.current)ctx.fill();
              ctx.strokeStyle = "rgba(163,199,208,.38)"; ctx.lineWidth = 0.75; ctx.stroke();
            }
          });
        }
      }

      // drifters as velocity-aligned streaks
      if (layers.currents) {
        const step = dt * rate;
        for (let i = 0; i < N; i++) {
          const lo = lon[i], la = lat[i];
          const [u, v] = sampleUV(field, lo, la);
          uu[i] = u; vv[i] = v;
          spd[i] = Math.min(1, Math.hypot(u, v));
          const cosLat = Math.max(0.18, Math.cos(la * DEG));
          let nlo = lo + (u * 1.7 * step) / cosLat;
          let nla = la + (v * 1.7 * step);
          if (nlo > 180) nlo -= 360; else if (nlo < -180) nlo += 360;
          if (!isWater(field, nlo, nla) || nla > 84 || nla < -84) {
            let rlo = 0, rla = 0, t = 0;
            do { rlo = Math.random() * 360 - 180; rla = (Math.random() * 2 - 1) * 82; t++; } while (!isWater(field, rlo, rla) && t < 30);
            lon[i] = rlo; lat[i] = rla; uu[i] = 0; vv[i] = 0; spd[i] = 0.2; continue;
          }
          lon[i] = nlo; lat[i] = nla;
        }
        ctx.lineCap = "round";
        for (let pass = 0; pass < 3; pass++) {
          ctx.beginPath();
          for (let i = 0; i < N; i++) {
            const s = spd[i];
            if (pass === 0 && s > 0.22) continue;
            if (pass === 1 && (s <= 0.22 || s > 0.55)) continue;
            if (pass === 2 && s <= 0.55) continue;
            const u = uu[i], v = vv[i];
            const mag = Math.hypot(u, v) || 1e-6;
            const len = 0.12 + 1.15 * s;
            const cosLat = Math.max(0.18, Math.cos(lat[i] * DEG));
            let tlo = lon[i] - (u / mag) * (len / cosLat);
            const tla = lat[i] - (v / mag) * len;
            if (tlo > 180) tlo -= 360; else if (tlo < -180) tlo += 360;
            const [hx, hy] = proj(lon[i], lat[i]);
            const [tx, ty] = proj(tlo, tla);
            if (Math.abs(hx - tx) > W) continue;
            ctx.moveTo(tx, ty); ctx.lineTo(hx, hy);
          }
          if (pass === 0) { ctx.strokeStyle = "rgba(28,120,145,.50)"; ctx.lineWidth = 1; }
          else if (pass === 1) { ctx.strokeStyle = "rgba(58,186,204,.78)"; ctx.lineWidth = 1.15; }
          else { ctx.strokeStyle = "rgba(210,150,92,.98)"; ctx.lineWidth = 1.35; }
          ctx.stroke();
        }
      }

      if (layers.labels) {
        ctx.font = "14px 'IBM Plex Mono', monospace";
        for (const o of OCEANS) {
          const [x, y] = proj(o.lon, o.lat);
          if (x < -100 || x > W + 100 || y < -20 || y > H + 20) continue;
          ctx.fillStyle = "rgba(214,232,248,.46)";
          ctx.fillText(st.locale === "en" ? o.name_en : o.name_cn, x + 9, y);
        }
      }

      // dive pins
      if (layers.divesites) {
        ctx.font = "14px 'IBM Plex Mono', monospace";
        for (const site of DIVE_SITES) {
          const [x, y] = proj(site.lon, site.lat);
          if (x < -60 || x > W + 60 || y < -20 || y > H + 20) continue;
          const sel = st.selection.kind === "dive" && st.selection.id === site.id;
          if (sel) {
            ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(197,138,85,.85)"; ctx.lineWidth = 1; ctx.stroke();
          }
          ctx.beginPath(); ctx.arc(x, y, sel ? 4 : 3, 0, Math.PI * 2);
          ctx.fillStyle = sel ? "#e6a869" : "#c58a55"; ctx.fill();
          if (diveMode && (zoomNow() > 1.6 || sel)) {
            ctx.fillStyle = sel ? "rgba(230,168,105,.95)" : "rgba(197,138,85,.7)";
            ctx.fillText(st.locale === "en" ? site.name_en : site.name_cn, x + 9, y + 3);
          }
        }
      }

      if(layers.wind||layers.rain){
        for(const p of useWeather.getState().points){const [x,y]=proj(p.lon,p.lat);if(x<0||x>W||y<0||y>H)continue;
         if(layers.rain){ctx.beginPath();ctx.arc(x,y,3+Math.min(p.rain??0,8)*1.6,0,Math.PI*2);ctx.fillStyle=(p.rain??0)>0?"#87aaffb0":"#5a8dca60";ctx.fill();}
         if(layers.wind&&p.direction!==null){const a=(p.direction+180)*DEG,len=8+Math.min(p.wind??0,20),dx=Math.sin(a)*len,dy=-Math.cos(a)*len;ctx.save();ctx.strokeStyle="#b5e5e8";ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+dx,y+dy);ctx.lineTo(x+dx-Math.sin(a+.6)*6,y+dy+Math.cos(a+.6)*6);ctx.moveTo(x+dx,y+dy);ctx.lineTo(x+dx-Math.sin(a-.6)*6,y+dy+Math.cos(a-.6)*6);ctx.stroke();ctx.restore();}
        }
      }
      // Approximate horizontal distance at the centre latitude (equirectangular projection).
      const kmPerPixel=111.32*Math.cos(view.current.lat*DEG)/scale();const targetKm=kmPerPixel*100;
      const power=10**Math.floor(Math.log10(Math.max(1,targetKm))),km=[1,2,5,10].map(v=>v*power).reverse().find(v=>v<=targetKm)||power;
      const bar=km/kmPerPixel;ctx.strokeStyle="#b6c4c9";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(18,H-30);ctx.lineTo(18+bar,H-30);ctx.moveTo(18,H-34);ctx.lineTo(18,H-26);ctx.moveTo(18+bar,H-34);ctx.lineTo(18+bar,H-26);ctx.stroke();ctx.fillStyle="#b6c4c9";ctx.font="12px sans-serif";ctx.fillText(`≈ ${km.toLocaleString()} km`,18,H-39);

      // cursor readout
      const hv = hoverRef.current;
      if (hv) {
        const [u, v] = sampleUV(field, hv.lo, hv.la);
        const sp = Math.hypot(u, v);
        ctx.font = "14px 'IBM Plex Mono', monospace";
        ctx.fillStyle = "rgba(214,232,248,.55)";
        ctx.fillText(`${Math.abs(hv.la).toFixed(1)}°${hv.la >= 0 ? "N" : "S"}  ${Math.abs(hv.lo).toFixed(1)}°${hv.lo >= 0 ? "E" : "W"}   ${sp.toFixed(2)} m/s`, 24, H - 18);
      }
    };

    let raf = 0, last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      draw(dt);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onDown = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, lon: view.current.lon, lat: view.current.lat };
    };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      if (drag.current) {
        const s = scale();
        view.current.lon = drag.current.lon - (e.clientX - drag.current.x) / s;
        view.current.lat = Math.max(-85, Math.min(85, drag.current.lat + (e.clientY - drag.current.y) / s));
        return;
      }
      const [lo, la] = unproj(mx, my);
      hoverRef.current = { lo, la };
      if(useAtlas.getState().panel==="weather"){useWeather.getState().inspect(lo,la);return;}
      const l=useAtlas.getState().layers;
      const c = (l.currents||l.field||l.warmcold)?pickCurrent(lo, la):null;
      if (c) { setHover({ label: translate("Current",useAtlas.getState().locale), sub: useAtlas.getState().locale === "en" ? c.name_en : c.name_cn, x: e.clientX, y: e.clientY }); return; }
      const o = isWater(field,lo,la) ? pickOcean(lo, la) : null;
      setHover(o ? { label: translate("Ocean",useAtlas.getState().locale), sub: useAtlas.getState().locale === "en" ? o.name_en : o.name_cn, x: e.clientX, y: e.clientY } : null);
    };
    const onUp = (e: PointerEvent) => {
      const moved = drag.current && (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y)) > 4;
      drag.current = null;
      if (moved) return;
      const r = canvas.getBoundingClientRect();
      const [lo, la] = unproj(e.clientX - r.left, e.clientY - r.top);
      if(useAtlas.getState().panel==="weather"){useWeather.getState().inspect(lo,la);return;}
      const l=useAtlas.getState().layers;
      if(useAtlas.getState().layers.divesites){
        const site=DIVE_SITES.find(site=>{const [x,y]=proj(site.lon,site.lat);return Math.hypot(x-(e.clientX-r.left),y-(e.clientY-r.top))<16;});
        if(site){select({kind:"dive",id:site.id});return;}
      }
      const c = (l.currents||l.field||l.warmcold)?pickCurrent(lo, la):null;
      if (c) { select({ kind: "current", id: c.id }); return; }
      const o = isWater(field,lo,la) ? pickOcean(lo, la) : null;
      if (o) select({ kind: "ocean", id: o.id });
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top;
      const [blo, bla] = unproj(mx, my);
      view.current.zoom = Math.max(1, Math.min(48, view.current.zoom * Math.exp(-e.deltaY * 0.0016)));
      const [alo, ala] = unproj(mx, my);
      view.current.lon += blo - alo;
      view.current.lat = Math.max(-85, Math.min(85, view.current.lat + (bla - ala)));
    };
    const onLeave = () => { setHover(null); drag.current = null; hoverRef.current = null; };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [field, speedCanvas, warmCanvas]);

  return (
    <div className="mapwrap" ref={wrapRef}>
      <canvas ref={canvasRef} role="img" aria-label={t("可拖动缩放的海洋地图；也可从资料库选择对象。","Interactive ocean map. You can also select features in the library.")} />
    </div>
  );
}
