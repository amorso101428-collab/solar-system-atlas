import type { SurfaceFeature } from './surfaceFeatures'
/** Texture registration is asset-specific, not a change to geographic coordinates. */
export const MAP_CENTRE_LONGITUDE: Record<string,number> = {earth:0,moon:0,mars:0,mercury:180,pluto:180}
export function anchoredFeature(body:string, feature:SurfaceFeature):boolean {
  if(body==='venus'||body==='uranus'||body==='neptune'||body==='sun'||body==='saturn')return false
  if(body==='jupiter')return feature.id==='great-red-spot'
  if(body==='pluto')return ['sputnik-planitia','tombaugh-regio'].includes(feature.id)
  if(body==='mercury')return ['caloris','caloris-antipode','rachmaninoff'].includes(feature.id)
  return true
}
export function textureCoordinates(body:string, feature:SurfaceFeature):{lat:number;lon:number} {
  // The GRS drifts: this is the feature measured in the bundled image, not an ephemeris.
  if(body==='jupiter'&&feature.id==='great-red-spot') return {lat:-22,lon:0.372*360-180}
  return {lat:feature.lat,lon:feature.lon-(MAP_CENTRE_LONGITUDE[body]??0)}
}
