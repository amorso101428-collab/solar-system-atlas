import assert from 'node:assert/strict';
import {initialMotion,nextMotion} from '../src/lib/uiMotion';
const oldWindow=globalThis.window,oldStorage=globalThis.sessionStorage;
const saved=new Map<string,string>();
try{
 Object.assign(globalThis,{window:{location:{search:''}},sessionStorage:{getItem:(key:string)=>saved.get(key)??null,setItem:(key:string,value:string)=>saved.set(key,value)}});
 assert.equal(initialMotion(),'auto','Default follows OS rather than forcing motion');
 saved.set('atlas.solarReturn',JSON.stringify({motion:'full'}));
 assert.equal(initialMotion(),'full','Earth inherits an explicit Solar motion choice');
 assert.equal(nextMotion('full'),'reduced');assert.equal(initialMotion(),'reduced');
 assert.equal(nextMotion('reduced'),'auto');assert.equal(initialMotion(),'auto');
 assert.equal(nextMotion('auto'),'full');assert.equal(initialMotion(),'full');
 Object.assign(globalThis.window.location,{search:'?motion=reduced'});assert.equal(initialMotion(),'reduced','Explicit route takes precedence');
 Object.assign(globalThis.window.location,{search:''});
 Object.assign(globalThis,{sessionStorage:{getItem:()=>{throw Error('Unavailable');},setItem:()=>{throw Error('Unavailable');}}});
 assert.equal(initialMotion(),'auto');assert.equal(nextMotion('auto'),'full','Blocked storage cannot break navigation');
 console.log('Shared UI motion: OS default, cross-page explicit preference, route override and optional storage passed.');
}finally{Object.assign(globalThis,{window:oldWindow,sessionStorage:oldStorage});}
