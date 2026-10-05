import type { CurrentField } from "./currentField";

/**
 * OACF — Ocean Atlas Current Field, a tiny binary container the browser can
 * parse without a NetCDF stack. The Python ETL (pipeline/fetch_copernicus.py)
 * writes exactly this layout; swap the producer and the rest of the app is
 * unchanged.
 *
 *   magic            4 bytes  "OACF"
 *   version          uint16LE (1)
 *   width, height    uint16LE
 *   lon0, lat0       float32LE
 *   dLon, dLat       float32LE
 *   timestamp        float64LE  (epoch ms)
 *   sourceLen        uint16LE + UTF-8 source
 *   resLen           uint16LE + UTF-8 resolution
 *   simulated        uint8
 *   u[]              int16LE * 10000  (m/s, eastward)
 *   v[]              int16LE * 10000  (m/s, northward)
 *   ocean[]          uint8   (1 = water)
 */
export function parseCurrentField(buf: ArrayBuffer): CurrentField {
  if(buf.byteLength<39)throw new Error("Truncated OACF header");
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== "OACF") throw new Error("not an OACF field: " + magic);

  let o = 4;
  const version = dv.getUint16(o, true); o += 2;
  const width = dv.getUint16(o, true); o += 2;
  const height = dv.getUint16(o, true); o += 2;
  const lon0 = dv.getFloat32(o, true); o += 4;
  const lat0 = dv.getFloat32(o, true); o += 4;
  const dLon = dv.getFloat32(o, true); o += 4;
  const dLat = dv.getFloat32(o, true); o += 4;
  const timestamp = dv.getFloat64(o, true); o += 8;
  const sLen = dv.getUint16(o, true); o += 2;
  const source = new TextDecoder().decode(u8.subarray(o, o + sLen)); o += sLen;
  const rLen = dv.getUint16(o, true); o += 2;
  const resolution = new TextDecoder().decode(u8.subarray(o, o + rLen)); o += rLen;
  const simulated = u8[o] === 1; o += 1;

  const n = width * height;
  if(version!==1||!width||!height||!Number.isFinite(timestamp)||!Number.isFinite(dLon)||!Number.isFinite(dLat)||dLon===0||dLat===0)throw new Error("Invalid OACF grid");
  if(buf.byteLength<o+n*5)throw new Error("Truncated OACF grid");
  const u = new Float32Array(n), v = new Float32Array(n), speed = new Float32Array(n);
  for (let i = 0; i < n; i++) u[i] = dv.getInt16(o + i * 2, true) / 10000;
  o += n * 2;
  for (let i = 0; i < n; i++) v[i] = dv.getInt16(o + i * 2, true) / 10000;
  o += n * 2;
  const ocean = u8.slice(o, o + n);
  for (let i = 0; i < n; i++) speed[i] = Math.hypot(u[i], v[i]);

  return { width, height, lon0, lat0, dLon, dLat, u, v, speed, ocean, warm: new Float32Array(n), source, resolution, simulated, timestamp };
}

/** Fetch a published field (R2 / CDN). Falls back to the caller's synthetic field. */
export async function loadCurrentField(url: string): Promise<CurrentField> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("field fetch failed: " + res.status);
  return parseCurrentField(await res.arrayBuffer());
}
