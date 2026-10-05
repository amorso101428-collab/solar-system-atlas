import { build } from 'esbuild';
import {restoreSourceAssets} from './restore-source-assets.mjs';
await restoreSourceAssets();
const uiMotionTest=await build({entryPoints:['tests/ui-motion.ts'],bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(uiMotionTest.outputFiles[0].text).toString('base64'));
const gatewayTest=await build({entryPoints:['tests/ocean-gateway.ts'],bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(gatewayTest.outputFiles[0].text).toString('base64'));
await import('../tests/heritage-ui.mjs');
const mobileTest=await build({entryPoints:['tests/mobile-ui.ts'],bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(mobileTest.outputFiles[0].text).toString('base64'));
const performanceTest=await build({entryPoints:['tests/earth-performance.ts'],bundle:true,platform:'node',format:'esm',write:false});
await import('data:text/javascript;base64,'+Buffer.from(performanceTest.outputFiles[0].text).toString('base64'));
for(const path of ['tests/ui-coordination.ts','tests/music-easter-eggs.ts','tests/weather-startup.ts','tests/precipitation-raster.ts','tests/time-detail-halo.ts','tests/imagery-service.ts','tests/screen-flow.ts','tests/domestic-streamlines.ts','tests/earth-seams-quality.ts','tests/flow-cloud-display.ts','tests/angular-momentum.ts','tests/earth-drag.ts','tests/entry-detail.ts','tests/music.ts','tests/geographic-labels.ts','tests/state.ts','tests/audit.ts','tests/assets.ts','tests/earth-navigation.ts','tests/environment.ts','tests/terrain.ts','tests/environment-service.ts']){
 const result=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false});
 try{await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));}catch(error){console.error(path,error.message,{actual:error.actual,expected:error.expected});process.exit(1);}
}
