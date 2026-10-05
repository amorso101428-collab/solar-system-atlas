import assert from 'node:assert/strict';
import { CURRENTS } from '../src/data/currents';
import { OCEANS, DEPTH_ZONES, SEAWATER } from '../src/data/oceans';
import { SPECIES } from '../src/data/species';
import { DIVE_SITES } from '../src/data/divesites';
import { LESSONS } from '../src/data/lessons';
import { translate } from '../src/i18n';
function walk(value:unknown,path:string){
 if(typeof value==='string'&&/[\u4e00-\u9fff]/.test(value)&&!path.endsWith('.name_local')){
  assert.equal(/[\u4e00-\u9fff]/.test(translate(value,'en')),false,'Missing English copy: '+path+' '+value);
 } else if(Array.isArray(value)) value.forEach((v,i)=>walk(v,path+'.'+i));
 else if(value&&typeof value==='object')Object.entries(value).forEach(([k,v])=>walk(v,path+'.'+k));
}
walk({CURRENTS,OCEANS,DEPTH_ZONES,SEAWATER,SPECIES,DIVE_SITES,LESSONS},'');

console.log('All Chinese data copy has English translations.');
