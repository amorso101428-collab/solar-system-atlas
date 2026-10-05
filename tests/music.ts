import assert from 'node:assert/strict';
const originals={window:(globalThis as any).window,localStorage:(globalThis as any).localStorage,sessionStorage:(globalThis as any).sessionStorage,document:(globalThis as any).document};
const prefs=new Map<string,string>();
const storage={getItem:(k:string)=>prefs.get(k)??null,setItem:(k:string,v:string)=>prefs.set(k,v),removeItem:(k:string)=>prefs.delete(k)};
const events=new EventTarget();
Object.assign(globalThis,{localStorage:storage,sessionStorage:storage,window:{localStorage:storage,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),setInterval:()=>1,clearInterval:()=>{},setTimeout:(fn:()=>void)=>setTimeout(fn,0)}});
let pending:(()=>void)|null=null;let plays=0;
class FakeAudio extends EventTarget{
 paused=true;src='';currentTime=0;duration=30;volume=1;preload='';
 async play(){plays++;this.paused=false;await new Promise<void>(resolve=>{pending=resolve});}
 pause(){this.paused=true;}
}
const elements:FakeAudio[]=[];
Object.assign(globalThis,{document:{createElement:()=>{const el=new FakeAudio();elements.push(el);return el;}}});
const {AudioManager,audio}=await import('../integrations/solar-system-atlas/src/audio/audioManager');
const manager=new AudioManager();
assert.equal(manager.isMusicEnabled(),true,'A fresh visit starts enabled');
manager.setAlbum([{id:'test',title:'Test',order:1,duration:30,file:'',netease:'1',stream:null}]);
const started=manager.playMusic();await Promise.resolve();
assert.equal(manager.isMusicEnabled(),true);
manager.pauseMusic();pending?.();await started;
assert.equal(manager.isMusicEnabled(),false);
assert.equal(manager.isMusicPlaying(),false);
assert.ok(elements.every(el=>el.paused),'A late play promise must not restart muted audio');
assert.equal(new AudioManager().isMusicEnabled(),true,'A fresh page re-enables music');
const {carryMusicChoice,initialMusicEnabled}=await import('../integrations/solar-system-atlas/src/audio/musicVisit');
carryMusicChoice(false);assert.equal(initialMusicEnabled(),false,'Internal navigation retains the current mute');
assert.equal(initialMusicEnabled(),true,'The hand-off is one-shot; a refresh starts enabled');
prefs.set('atlas.music.handoff',JSON.stringify({enabled:false,at:Date.now()-20000}));assert.equal(initialMusicEnabled(),true);
prefs.set('atlas.music.enabled','false');assert.equal(new AudioManager().isMusicEnabled(),true,'Old persisted mute must not disable a new visit');
audio.setEnabled(false);
events.dispatchEvent(new Event('pointerdown'));
assert.equal(plays,1,'A later gesture cannot restart muted music');
Object.assign(globalThis,originals);
console.log('Enabled visit default, one-shot navigation choice, refresh reset and late-play cancellation passed.');
