import { buildSyntheticField, applyOceanMask, applyWarmth, type CurrentField } from "./currentField";
import { parseCurrentField } from "./currentFieldBinary";

/** Published-field manifest. Written by the ETL, served from R2 / the CDN. */
export interface FieldManifest {
  file: string;
  source: string;
  resolution: string;
  timestamp: string | number;   // valid time of the data
  updatedAt?: string | number;  // when it was published
  mode?: string;                // ANALYSIS | FORECAST
  simulated?: boolean;
  license?: string;
}

export class FieldLoadError extends Error {
  constructor(public stage: "manifest" | "field", message: string) {
    super(message);
    this.name = "FieldLoadError";
  }
}

export const toMs = (v: string | number | undefined, fallback = Date.now()): number => {
  if (typeof v === "number") return v;
  if (!v) return fallback;
  const t = Date.parse(v);
  return Number.isNaN(t) ? fallback : t;
};

export function makeFallbackField(): CurrentField {
  const validT = Math.floor(Date.now() / 3600000) * 3600000;
  const f = buildSyntheticField(720, 360, validT);
  applyWarmth(f);
  return f;
}

export function loadWaterMask(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/earth/earth-mask.png";   // R channel = water mask
  });
}

export function attachMask(field: CurrentField, img: HTMLImageElement | null) {
  if (img) applyOceanMask(field, img);
  return field;
}

/**
 * Try to load a real published field. Throws FieldLoadError so the caller can
 * distinguish "no feed wired yet" (manifest 404 -> expected, stay silent) from
 * "feed exists but is broken" (should surface as DEGRADED).
 */
export async function loadPublishedField(manifestUrl: string): Promise<{ field: CurrentField; manifest: FieldManifest }> {
  let res: Response;
  try {
    res = await fetch(manifestUrl, { cache: "no-store",signal:AbortSignal.timeout(20000) });
  } catch (e) {
    throw new FieldLoadError("manifest", "manifest fetch failed: " + String(e));
  }
  if (!res.ok) throw new FieldLoadError("manifest", "manifest HTTP " + res.status);

  let manifest: FieldManifest;
  try {
    manifest = await res.json();
  } catch {
    throw new FieldLoadError("manifest", "manifest is not valid JSON");
  }
  if (!manifest || !manifest.file) throw new FieldLoadError("manifest", "manifest has no 'file'");

  let bin: Response;
  try {
    bin = await fetch(manifest.file, { cache: "no-store",signal:AbortSignal.timeout(20000) });
  } catch (e) {
    throw new FieldLoadError("field", "field fetch failed: " + String(e));
  }
  if (!bin.ok) throw new FieldLoadError("field", "field HTTP " + bin.status);

  let field: CurrentField;
  try {
    field = parseCurrentField(await bin.arrayBuffer());
    applyWarmth(field);
  } catch (e) {
    throw new FieldLoadError("field", "field parse failed: " + String(e));
  }
  return { field, manifest };
}
