import assert from 'node:assert/strict';
import {earthRenderBudget,shouldRestoreEarthQuality} from '../src/lib/earthPerformance';
assert.equal(shouldRestoreEarthQuality(1000,900,false),false);
assert.equal(shouldRestoreEarthQuality(1500,900,true),false);
assert.equal(shouldRestoreEarthQuality(1500,900,false),true,'Missing moveEnd must still restore idle quality');
for(const quality of ['LOW','MEDIUM','HIGH'] as const)for(const [width,height] of [[390,844],[1440,900],[3840,2160]]){
 const rest=earthRenderBudget(width,height,1,quality,false),drag=earthRenderBudget(width,height,1,quality,true),retina=earthRenderBudget(width,height,2,quality,true);
 assert.ok(drag.scale<=rest.scale);assert.ok(drag.screenError>=rest.screenError);
 assert.equal(retina.scale*2,drag.scale,'DPR must not multiply the rendering budget');
 assert.ok(width*height*drag.scale**2<=800001,'Dragging stays within the pixel budget');
 assert.ok(drag.scale>0);
}
assert.equal(earthRenderBudget(1452,1193,1,'MEDIUM',false).scale,1,'Screenshot-sized regional view must not upscale a low-resolution canvas');
console.log('Earth performance: sharp idle pixels, bounded drag pixels, high-DPI protection and idle quality restoration passed.');
