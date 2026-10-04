import assert from 'node:assert/strict'
import { Vector3, Quaternion, SphereGeometry } from 'three'
import { surfaceDirection } from '../src/utils/surfaceCoordinates.ts'
const mesh=new SphereGeometry(1,360,180)
const pos=mesh.getAttribute('position'), uv=mesh.getAttribute('uv')
let checked=0
for(let i=0;i<pos.count;i+=17){
  if(uv.getY(i)<.01 || uv.getY(i)>.99)continue
  const expected=new Vector3().fromBufferAttribute(pos,i)
  const actual=surfaceDirection(uv.getY(i)*180-90, uv.getX(i)*360-180)
  assert.ok(actual.distanceTo(expected)<1e-6,'UV and geographic coordinates disagree')
  const rotation=new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),1.34)
  assert.ok(actual.applyQuaternion(rotation).distanceTo(expected.applyQuaternion(rotation))<1e-6)
  checked++
}
assert.ok(surfaceDirection(0,90).z<-.999)
assert.ok(surfaceDirection(90,0).y>.999)
mesh.dispose()
console.log(`PASS: ${checked} UV/latitude-longitude and rotated anchor checks`)
