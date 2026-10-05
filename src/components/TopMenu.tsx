import { useEffect, useRef, useState } from "react";
import { useAtlas } from "../state/store";
import { GROUPS, GROUP_LABEL, LAYERS, type LayerGroup } from "../lib/layerRegistry";

/**
 * Integrated layer menu across the top of the screen.
 * Generated entirely from src/lib/layerRegistry.ts — every row carries its
 * real source, resolution and provenance.
 */
export default function TopMenu() {
  const [open, setOpen] = useState<LayerGroup | null>(null);
  const layers = useAtlas((s) => s.layers);
  const toggleLayer = useAtlas((s) => s.toggleLayer);
  const mode = useAtlas((s) => s.mode);
  const setMode = useAtlas((s) => s.setMode);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    // deep link: ?menu=OCEAN opens that group on load
    const m = (new URLSearchParams(window.location.search).get("menu") || "").toUpperCase();
    if ((GROUPS as string[]).includes(m)) setOpen(m as LayerGroup);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const count = (g: LayerGroup) => {
    const all = LAYERS.filter((l) => l.group === g && l.live);
    return { on: all.filter((l) => layers[l.id]).length, total: all.length };
  };

  return (
    <>
      {open && <div className="topmenu__scrim" onClick={() => setOpen(null)} />}
      <nav className="topmenu" ref={ref}>
        {GROUPS.map((g) => {
          const c = count(g);
          return (
            <div key={g} className="topmenu__group">
              <button
                className={"topmenu__btn" + (open === g ? " is-open" : "") + (c.on ? " is-active" : "")}
                onClick={() => setOpen(open === g ? null : g)}
              >
                <span className="topmenu__cn">{GROUP_LABEL[g].cn}</span>
                <span className="topmenu__en">{GROUP_LABEL[g].en}</span>
                <span className="topmenu__count">{c.on}/{c.total}</span>
                <span className="topmenu__caret">▾</span>
              </button>

              {open === g && (
                <div className="topmenu__panel">
                  <div className="topmenu__panelhead">
                    <span>{GROUP_LABEL[g].en}</span>
                    <span className="topmenu__panelcn">{GROUP_LABEL[g].cn}</span>
                  </div>
                  {LAYERS.filter((l) => l.group === g).map((l) => (
                    <button
                      key={l.id}
                      className={"layrow" + (layers[l.id] ? " is-on" : "") + (l.live ? "" : " is-pending")}
                      onClick={() => { if (l.live && l.id !== "monsoon") toggleLayer(l.id); }}
                      disabled={!l.live}
                      title={l.note || ""}
                    >
                      <i className="layrow__switch" />
                      <span className="layrow__names">
                        <b>{l.en}</b>
                        <em>{l.cn}</em>
                      </span>
                      <span className="layrow__meta">
                        <span className="layrow__src">
                          {l.source.name}
                          {l.source.resolution ? " · " + l.source.resolution : ""}
                          {l.source.latency ? " · " + l.source.latency : ""}
                        </span>
                        <span className={"layrow__prov prov--" + l.provenance.toLowerCase()}>{l.provenance}</span>
                        {!l.live && <span className="layrow__pending">PIPELINE</span>}
                      </span>
                    </button>
                  ))}
                  {g === "ATMOSPHERE" && <MonsoonRow />}
                  {g === "VIEW" && <ModeRow mode={mode} setMode={setMode} />}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </>
  );
}

function MonsoonRow() {
  const monsoon = useAtlas((s) => s.monsoon);
  const setMonsoon = useAtlas((s) => s.setMonsoon);
  const wind = useAtlas((s) => s.layers.wind);
  const toggle = useAtlas((s) => s.toggleLayer);
  return (
    <div className="layrow layrow--sub">
      <i className={"layrow__switch" + (wind ? " is-on" : "")} onClick={() => toggle("wind")} />
      <span className="layrow__names"><b>MONSOON PHASE</b><em>季风相位</em></span>
      <span className="layrow__meta">
        <span className="tagrow">
          {(["SUMMER", "WINTER", "COMPARE"] as const).map((k) => (
            <button key={k} className={"tbtn" + (monsoon === k ? " is-active" : "")} onClick={() => setMonsoon(k)}>
              {k === "SUMMER" ? "夏" : k === "WINTER" ? "冬" : "对比"}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}

function ModeRow({ mode, setMode }: { mode: string; setMode: (m: any) => void }) {
  return (
    <div className="layrow layrow--sub">
      <i className="layrow__switch" style={{ visibility: "hidden" }} />
      <span className="layrow__names"><b>MODE</b><em>模式</em></span>
      <span className="layrow__meta">
        <span className="tagrow">
          {(["EXPLORE", "GEOGRAPHY", "DIVE"] as const).map((m) => (
            <button key={m} className={"tbtn" + (mode === m ? " is-active" : "")} onClick={() => setMode(m)}>
              {m === "EXPLORE" ? "探索" : m === "GEOGRAPHY" ? "地理" : "潜水"}
            </button>
          ))}
        </span>
      </span>
    </div>
  );
}
