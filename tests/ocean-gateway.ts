import assert from 'node:assert/strict'
import { oceanEntry, navigateOcean } from '../integrations/solar-system-atlas/src/utils/oceanEntry'
import { parseUIMotion } from '../integrations/solar-system-atlas/src/state/uiMotion'
import { isEarthLink } from '../src/lib/entryRoute'

for (const lang of ['en', 'zh'] as const) {
  const entry = oceanEntry(lang), q = new URLSearchParams(entry.slice(2))
  assert.equal(q.get('lang'), lang)
  assert.equal(q.get('view'), 'globe')
  assert.equal(q.get('from'), 'solar')
  assert.equal(q.get('handoff'), '1')
  assert.ok(isEarthLink(entry.slice(1)))
}
assert.equal(new URLSearchParams(oceanEntry('zh', { lon: NaN, lat: Infinity }).slice(2)).get('lon'), '28.000')
assert.equal(new URLSearchParams(oceanEntry('en', { lon: 550, lat: -120 }).slice(2)).get('lon'), '-170.000')
assert.equal(new URLSearchParams(oceanEntry('en', { lon: 550, lat: -120 }).slice(2)).get('lat'), '-90.000')
for (const value of [null, '', 'bad']) assert.equal(parseUIMotion(value), 'auto')
for (const value of ['full', 'reduced'] as const) assert.equal(parseUIMotion(value), value)
const arrival={lon:28,lat:-8},destinations:string[]=[],order:string[]=[]
navigateOcean('zh',arrival,()=>{order.push('prepare');arrival.lon=103.307;arrival.lat=28.51},url=>{order.push('navigate');destinations.push(url)})
assert.deepEqual(order,['prepare','navigate'],'Navigation is synchronous, not scheduled after an animation')
assert.equal(new URLSearchParams(destinations[0].slice(2)).get('lon'),'103.307','Capture the observation direction before creating the destination')
navigateOcean('en',arrival,()=>{throw new Error('Storage unavailable')},url=>destinations.push(url))
assert.equal(destinations.length,2,'Optional preparation failure cannot swallow the click')
assert.equal(new URLSearchParams(destinations[1].slice(2)).get('lang'),'en')
console.log('Ocean gateway: explicit synchronous navigation, preparation failure fallback, observation direction, Earth route, language and UI motion passed.')
