import { Vector3 } from 'three'
/** East-positive geographic longitude; equirectangular maps centred on 0°.
 * SphereGeometry: x=-cos(2πu)sinθ, z=sin(2πu)sinθ; u=(lon+180)/360.
 * Therefore east longitude maps toward negative Z, not positive Z.
 */
export function surfaceDirection(lat:number, lon:number, out = new Vector3()):Vector3 {
  const phi=lat*Math.PI/180, lambda=lon*Math.PI/180
  return out.set(Math.cos(phi)*Math.cos(lambda), Math.sin(phi), -Math.cos(phi)*Math.sin(lambda))
}
