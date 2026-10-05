import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveLayoutMode,deviceClassOf} from '../integrations/solar-system-atlas/src/responsive/device';
for(const [w,h] of [[320,568],[375,667],[390,844],[430,932]]) {
 assert.equal(resolveLayoutMode(w,h,false),'mobile-portrait');
 assert.equal(resolveLayoutMode(w,h,true),'mobile-portrait');
}
assert.equal(resolveLayoutMode(844,390,true),'mobile-landscape');
assert.equal(resolveLayoutMode(844,390,false,'mobile'),'mobile-landscape');
assert.equal(resolveLayoutMode(1440,900,false),'desktop');
assert.equal(resolveLayoutMode(390,844,true,'desktop'),'desktop');
assert.equal(deviceClassOf(resolveLayoutMode(768,1024,true)),'tablet');
const solar=readFileSync('integrations/solar-system-atlas/src/main.tsx','utf8');
assert.ok(solar.lastIndexOf('mobile-ui.css')>solar.lastIndexOf('music-layout.css'));
assert.ok(readFileSync('src/earth-entry.tsx','utf8').includes('mobile-ui.css'));
assert.ok(readFileSync('integrations/solar-system-atlas/src/App.tsx','utf8').includes('MobileReadingSheet'));
assert.ok(!readFileSync('integrations/solar-system-atlas/src/ui/MobileReadingSheet.tsx','utf8').includes('--sheet-y'));
console.log('Phone widths, orientation, explicit override, desktop/tablet classification and final mobile stylesheet wiring passed.');
