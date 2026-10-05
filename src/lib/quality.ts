export type Quality = "HIGH" | "MEDIUM" | "LOW";
export const QUALITY_STOPS:readonly Quality[]=['LOW','MEDIUM','HIGH'];
export function snapQuality(position:number){const index=Math.max(0,Math.min(2,Math.round(Number.isFinite(position)?position:1)));return {index,quality:QUALITY_STOPS[index]};}

/** Plan §17: pick a tier from what the device actually looks like. */
export function detectQuality(): Quality {
  try {
    const cores = navigator.hardwareConcurrency ?? 4;
    const mem = (navigator as any).deviceMemory ?? 8;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const small = Math.min(window.innerWidth, window.innerHeight) < 700;
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return "LOW";
    if (small || mem <= 2 || cores <= 2) return "LOW";
    if (coarse || cores <= 4 || mem <= 4) return "MEDIUM";
    return "HIGH";
  } catch {
    return "MEDIUM";
  }
}

export function qualityOverride(): Quality | null {
  const q = (new URLSearchParams(window.location.search).get("quality") || "").toUpperCase();
  return q === "HIGH" || q === "MEDIUM" || q === "LOW" ? (q as Quality) : null;
}
