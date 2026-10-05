/**
 * CurrentField — the single abstraction the whole site consumes.
 *
 * Today it is filled by an analytic, physically-shaped global surface field
 * (gyres + equatorial system + ACC + western-boundary jets).  Swapping in a real
 * Copernicus Marine / HYCOM product only means replacing the producer: the
 * schema, the texture encoder and the particle advection stay identical.
 */
export interface CurrentField {
  width: number; height: number;
  lon0: number; lat0: number; dLon: number; dLat: number;
  u: Float32Array; v: Float32Array; speed: Float32Array;
  ocean: Uint8Array;
  /** -1 = cold current, +1 = warm current, 0 = open ocean. Filled by applyWarmth(). */
  warm: Float32Array;
  source: string; resolution: string; simulated: boolean; timestamp: number;
}

import { CURRENTS } from "../data/currents";
import { distToPath } from "./pick";

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const g = (x: number, c: number, s: number) => Math.exp(-((x - c) * (x - c)) / (2 * s * s));
const g2 = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) * (x - cx)) / (2 * sx * sx) + ((y - cy) * (y - cy)) / (2 * sy * sy)));

interface Gyre { lon: number; lat: number; sx: number; sy: number; amp: number; }
interface Jet { a: [number, number]; b: [number, number]; speed: number; width: number; }

const GYRES: Gyre[] = [
  { lon: -155, lat: 30, sx: 46, sy: 17, amp: 62 },   // North Pacific (clockwise)
  { lon: -120, lat: -30, sx: 50, sy: 17, amp: -58 }, // South Pacific
  { lon: -42, lat: 33, sx: 27, sy: 15, amp: 66 },    // North Atlantic
  { lon: -18, lat: -28, sx: 27, sy: 15, amp: -62 },  // South Atlantic
  { lon: 76, lat: -28, sx: 36, sy: 16, amp: -58 },   // Indian Ocean
  { lon: -150, lat: 62, sx: 34, sy: 9, amp: -16 },   // Beaufort / subpolar
];

const JETS: Jet[] = [
  { a: [-80, 26], b: [-45, 42], speed: 0.92, width: 3.4 },   // Gulf Stream
  { a: [122, 22], b: [146, 37], speed: 0.86, width: 3.2 },   // Kuroshio
  { a: [35, -24], b: [22, -38], speed: 0.72, width: 3.0 },   // Agulhas
  { a: [153, -15], b: [151, -38], speed: 0.62, width: 2.7 }, // East Australian
  { a: [37, -10], b: [53, -38], speed: 0.62, width: 2.9 },   // Brazil
  { a: [58, 58], b: [48, 42], speed: 0.5, width: 3.1 },      // Labrador (cold)
  { a: [-127, 42], b: [-115, 24], speed: 0.42, width: 2.7 }, // California (cold)
  { a: [-80, -10], b: [-73, -38], speed: 0.47, width: 2.7 }, // Peru / Humboldt (cold)
  { a: [18, -18], b: [12, -34], speed: 0.45, width: 2.7 },   // Benguela (cold)
  { a: [-45, 45], b: [-10, 55], speed: 0.38, width: 6.5 },   // North Atlantic Drift
  { a: [-20, 32], b: [-18, 18], speed: 0.36, width: 3.0 },   // Canary (cold)
  { a: [110, -32], b: [108, -18], speed: 0.3, width: 3.0 },  // West Australian (cold)
  { a: [-40, -42], b: [-52, -46], speed: 0.4, width: 3.4 },  // Brazil–Malvinas confluence
];

function baseVelocity(lon: number, lat: number, phase: number): [number, number] {
  let u = 0, v = 0;

  // --- basin-scale subtropical gyres from a gaussian streamfunction ---
  for (const y of GYRES) {
    // A periodic streamfunction and its derivative agree across ±180°.
    // Sum neighboring copies instead of abruptly changing coordinate charts.
    for (const offset of [-360, 0, 360]) {
      const dx = lon - y.lon + offset;
      const p = g2(dx, lat, 0, y.lat, y.sx, y.sy) * y.amp / 100;
      u += 2 * p * (lat - y.lat) / (y.sy * y.sy) * 6.2;
      v += -2 * p * dx / (y.sx * y.sx) * 6.2;
    }
  }

  // --- zonal equatorial system ---
  u += -0.42 * g(lat, -3, 7.5);            // South Equatorial Current (westward)
  u += -0.3 * g(lat, 11.5, 6.5);           // North Equatorial Current (westward)
  u += 0.5 * g(lat, 6.5, 2.6);             // Equatorial Counter Current (eastward)
  u += 0.16 * g(lat, -12, 5);

  // --- Antarctic Circumpolar Current ---
  u += 0.3 * g(lat, -55, 8.5);
  u += -0.07 * g(lat, -66, 2.5);           // coastal counter-current

  // --- western boundary / eastern boundary jets ---
  for (const j of JETS) {
    const [x1, y1] = j.a, [x2, y2] = j.b;
    let dx = x2 - x1;
    if (Math.abs(dx) > 180) dx -= Math.sign(dx) * 360;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let px = lon - x1;
    if (Math.abs(px) > 180) px -= Math.sign(px) * 360;
    const py = lat - y1;
    let t = (px * dx + py * dy) / len2;
    t = clamp(t, 0, 1);
    const cx = x1 + dx * t, cy = y1 + dy * t;
    let ex = lon - cx;
    if (Math.abs(ex) > 180) ex -= Math.sign(ex) * 360;
    const ey = lat - cy;
    const dist = Math.hypot(ex, ey);
    const falloff = Math.exp(-(dist * dist) / (2 * j.width * j.width));
    const lonScale = Math.max(0.28, Math.cos(cy * Math.PI / 180));
    u += (dx / Math.hypot(dx, dy)) * j.speed * falloff;
    v += (dy / Math.hypot(dx, dy)) * j.speed * falloff * lonScale;
  }

  // --- slow mesoscale texture so the field never looks synthetic ---
  const longitude = lon * Math.PI / 180;
  const n = 0.052 * Math.sin(longitude * 7 + phase * 3.38 + lat * 0.21)
          + 0.038 * Math.sin(lat * 0.42 - longitude * 4 - phase * 2.8)
          + 0.026 * Math.cos(longitude * 18 + lat * 0.17 - phase * 12);
  u += n;
  v += n * 0.62;

  // polar damping (ice + weak circulation)
  const polar = clamp(1 - Math.abs(lat) / 88, 0, 1);
  return [u * (0.35 + 0.65 * polar), v * (0.35 + 0.65 * polar)];
}

export function buildSyntheticField(width = 720, height = 360, timestamp = Date.now()): CurrentField {
  const dLon = 360 / width, dLat = 180 / height;
  const u = new Float32Array(width * height);
  const v = new Float32Array(width * height);
  const speed = new Float32Array(width * height);
  const ocean = new Uint8Array(width * height).fill(1);
  const phase = 0;
  for (let j = 0; j < height; j++) {
    const lat = -90 + (j + 0.5) * dLat;
    for (let i = 0; i < width; i++) {
      const lon = -180 + (i + 0.5) * dLon;
      const [uu, vv] = baseVelocity(lon, lat, phase);
      const k = j * width + i;
      u[k] = uu; v[k] = vv; speed[k] = Math.hypot(uu, vv);
    }
  }
  return { width, height, lon0: -180, lat0: -90, dLon, dLat, u, v, speed, ocean,
    warm: new Float32Array(width * height),
    source: "OCEAN ATLAS ANALYTIC FIELD", resolution: "0.5deg", simulated: true, timestamp };
}

/** Cut the field to water only, using the earth water-mask image. */
export function applyOceanMask(field: CurrentField, img: HTMLImageElement) {
  // NOTE: image row 0 is the north pole; field row 0 is the south pole.
  // Mirror vertically or the mask lands upside-down on the field.
  const c = document.createElement("canvas");
  c.width = field.width; c.height = field.height;
  const ctx = c.getContext("2d")!;
  ctx.translate(0, field.height);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0, field.width, field.height);
  const d = ctx.getImageData(0, 0, field.width, field.height).data;
  for (let j = 0; j < field.height; j++) {
    for (let i = 0; i < field.width; i++) {
      const k = j * field.width + i;
      const p = k * 4;
      const isWater = d[p] > 110 ? 1 : 0;
      field.ocean[k] = isWater;
      if (!isWater) { field.u[k] = 0; field.v[k] = 0; field.speed[k] = 0; }
    }
  }
  return field;
}

/**
 * Tag the field with warm/cold provenance by projecting the named currents onto
 * the grid. This is what lets GEOGRAPHY mode paint 暖流 amber and 寒流 cyan while
 * still using the same velocity data as every other view.
 */
export function applyWarmth(field: CurrentField, radiusDeg = 10): CurrentField {
  const warm = new Float32Array(field.width * field.height);
  for (let j = 0; j < field.height; j++) {
    const lat = field.lat0 + (j + 0.5) * field.dLat;
    for (let i = 0; i < field.width; i++) {
      const lon = field.lon0 + (i + 0.5) * field.dLon;
      let best = 1e9, val = 0;
      for (const c of CURRENTS) {
        const d = distToPath(lon, lat, c.path);
        if (d < best) { best = d; val = c.kind === "WARM" ? 1 : -1; }
      }
      if (best <= radiusDeg) warm[j * field.width + i] = val * (1 - best / radiusDeg);
    }
  }
  field.warm = warm;
  return field;
}

/** RGBA texture holding warmth in R. */
export function encodeWarmthTexture(field: CurrentField): Uint8Array {
  const n = field.width * field.height;
  const out = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const p = k * 4;
    out[p] = clamp((field.warm[k] * 0.5 + 0.5) * 255, 0, 255);
    out[p + 1] = 0; out[p + 2] = 0; out[p + 3] = 255;
  }
  return out;
}

export function flowLevel(speed: number): "CALM" | "SLIGHT" | "MODERATE" | "STRONG" | "VERY STRONG" {
  if (speed < 0.15) return "CALM";
  if (speed < 0.35) return "SLIGHT";
  if (speed < 0.7) return "MODERATE";
  if (speed < 1.1) return "STRONG";
  return "VERY STRONG";
}

export function sampleUV(field: CurrentField, lon: number, lat: number): [number, number] {
  let x = (lon - field.lon0) / field.dLon - 0.5;
  let y = (lat - field.lat0) / field.dLat - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const tx = x - x0, ty = y - y0;
  const wrap = (ix: number) => ((ix % field.width) + field.width) % field.width;
  const cy = (iy: number) => clamp(iy, 0, field.height - 1);
  const idx = (ix: number, iy: number) => cy(iy) * field.width + wrap(ix);
  const bilerp = (arr: Float32Array) => {
    const a = arr[idx(x0, y0)], b = arr[idx(x0 + 1, y0)], c2 = arr[idx(x0, y0 + 1)], d = arr[idx(x0 + 1, y0 + 1)];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c2 * (1 - tx) + d * tx) * ty;
  };
  return [bilerp(field.u), bilerp(field.v)];
}

export function isWater(field: CurrentField, lon: number, lat: number): boolean {
  const column = Math.floor((lon - field.lon0) / field.dLon);
  const x = ((column % field.width) + field.width) % field.width;
  const y = clamp(Math.floor((lat - field.lat0) / field.dLat), 0, field.height - 1);
  return field.ocean[y * field.width + x] === 1;
}

/** Encode the field into an RGBA8 texture: R=u, G=v, B=speed, A=water. */
export function encodeFieldTexture(field: CurrentField): Uint8Array {
  const n = field.width * field.height;
  const out = new Uint8Array(n * 4);
  for (let k = 0; k < n; k++) {
    const p = k * 4;
    out[p] = clamp((field.u[k] / 2 + 0.5) * 255, 0, 255);
    out[p + 1] = clamp((field.v[k] / 2 + 0.5) * 255, 0, 255);
    out[p + 2] = clamp((field.speed[k] / 1.5) * 255, 0, 255);
    out[p + 3] = field.ocean[k] ? 255 : 0;
  }
  return out;
}

export function bearing(u: number, v: number): number {
  const deg = (Math.atan2(u, v) * 180) / Math.PI;
  return (deg + 360) % 360;
}
