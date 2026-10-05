import * as topojson from "topojson-client";

export const DEG = Math.PI / 180;

/** Match three.js SphereGeometry UV layout for an equirectangular earth texture. */
export function lonLatToVec3(lon: number, lat: number, r: number): [number, number, number] {
  const u = (lon + 180) / 360;
  const phi = u * Math.PI * 2;
  const theta = (90 - lat) * DEG;
  const st = Math.sin(theta);
  return [-r * Math.cos(phi) * st, r * Math.cos(theta), r * Math.sin(phi) * st];
}

export interface GeoFeature { type: string; properties: any; geometry: any; }

let landCache: any = null;
export async function loadLand(): Promise<GeoFeature[]> {
  if (landCache) return landCache;
  const topo = await fetch("/geo/land-110m.json").then((r) => r.json());
  const fc: any = topojson.feature(topo, topo.objects.land);
  landCache = (fc.features ?? [fc]) as GeoFeature[];
  return landCache;
}

let countryCache: any = null;
export async function loadCountries(): Promise<GeoFeature[]> {
  if (countryCache) return countryCache;
  const topo = await fetch("/geo/countries-110m.json").then((r) => r.json());
  const fc: any = topojson.feature(topo, topo.objects.countries);
  countryCache = fc.features as GeoFeature[];
  return countryCache;
}

/** Iterate polygon rings from a GeoJSON MultiPolygon/Polygon geometry. */
export function eachRing(geom: any, cb: (ring: number[][], polygonIndex: number) => void) {
  if (!geom) return;
  if (geom.type === "Polygon") geom.coordinates.forEach((r: number[][], i: number) => cb(r, i));
  else if (geom.type === "MultiPolygon") geom.coordinates.forEach((poly: number[][][], pi: number) => poly.forEach((r) => cb(r, pi)));
}

export function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
