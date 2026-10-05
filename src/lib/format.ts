const pad = (n: number) => String(n).padStart(2, "0");

export function utcStamp(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
export function utcDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}`;
}
export function utcClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
export function relTime(ms: number, now = Date.now()): string {
  const s = Math.round((now - ms) / 1000);
  if (s < 60) return `${s}s AGO`;
  if (s < 3600) return `${Math.round(s / 60)} MIN AGO`;
  if (s < 86400) return `${(s / 3600).toFixed(1)} H AGO`;
  return `${Math.round(s / 86400)} D AGO`;
}
export function coord(lon: number, lat: number): string {
  const lo = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? "E" : "W"}`;
  const la = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"}`;
  return `${la}  ${lo}`;
}
export function psu(sal: number): string { return `${sal.toFixed(1)} PSU`; }

/** API timestamps lacking an offset are UTC (Open-Meteo uses timezone=GMT). */
export function timestampMs(value:number|string):number {
 if(typeof value==='number')return value;
 return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)?value:value+'Z');
}
export function chinaStamp(value:number|string):string {
 const ms=timestampMs(value);if(!Number.isFinite(ms))return '—';
 const d=new Date(ms+8*3600000);
 return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC+8`;
}
export function forecastIsStale(value:string,now=Date.now()){const stamp=timestampMs(value);return !Number.isFinite(stamp)||Math.abs(now-stamp)>6*3600000;}
