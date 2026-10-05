import { CURRENTS, type CurrentDossier } from "../data/currents";
import { OCEANS, type OceanDossier } from "../data/oceans";

function wrapDeg(d: number) { while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

export function distToPath(lon: number, lat: number, path: [number, number][]): number {
  let best = 1e9;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, ay] = path[i], [bx, by] = path[i + 1];
    const d = segDist(ax + wrapDeg(lon - ax), lat, ax, ay, ax + wrapDeg(bx - ax), by);
    best = Math.min(best, d);
  }
  if (path.length === 1) best = Math.hypot(wrapDeg(lon - path[0][0]), lat - path[0][1]);
  return best;
}

export function pickCurrent(lon: number, lat: number, maxDeg = 7): CurrentDossier | null {
  let best: CurrentDossier | null = null, bestD = maxDeg;
  for (const c of CURRENTS) {
    const d = distToPath(lon, lat, c.path);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

const OCEAN_BOX: Record<string, [number, number, number, number]> = {
  pacific: [-180, 180, -60, 66],
  atlantic: [-100, 20, -60, 66],
  indian: [20, 120, -60, 30],
  southern: [-180, 180, -90, -45],
  arctic: [-180, 180, 66, 90],
};

export function pickOcean(lon: number, lat: number): OceanDossier | null {
  const order = ["southern", "arctic", "indian", "atlantic", "pacific"];
  for (const id of order) {
    const [x0, x1, y0, y1] = OCEAN_BOX[id];
    let x = lon;
    if (id === "atlantic") { if (x < -100) continue; }
    if (x >= x0 && x <= x1 && lat >= y0 && lat <= y1) return OCEANS.find((o) => o.id === id) ?? null;
  }
  return null;
}

/** screen-pixel -> approximate lon/lat on the front hemisphere */
export function sphereHitToLonLat(p: { x: number; y: number; z: number }, radius: number): [number, number] {
  const n = { x: p.x / radius, y: p.y / radius, z: p.z / radius };
  const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) * 180 / Math.PI;
  const phi = Math.atan2(n.z, -n.x);
  let lon = (phi * 180 / Math.PI) - 180;
  lon = wrapDeg(lon);
  return [lon, lat];
}
