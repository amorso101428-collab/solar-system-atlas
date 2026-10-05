import assert from 'node:assert/strict';
import {GRAND_BLUE,WHAT_A_LIFE,isDenmark,musicForContext} from '../src/lib/musicEasterEggs';

const original={window:(globalThis as any).window,document:(globalThis as any).document};
const events=new EventTarget(),delayed:Array<()=>void>=[],pending:Array<()=>void>=[];
let defer=false,plays=0;
const storage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
Object.assign(globalThis,{window:{localStorage:storage,sessionStorage:storage,addEventListener:events.addEventListener.bind(events),removeEventListener:events.removeEventListener.bind(events),dispatchEvent:events.dispatchEvent.bind(events),setInterval:()=>1,clearInterval:()=>{},setTimeout:(fn:()=>void)=>{delayed.push(fn);return 1;}}});
class FakeAudio extends EventTarget {
 paused=true;src='';currentTime=0;duration=30;volume=0;preload='';ended=false;error=null;
 async play(){plays++;this.paused=false;if(defer)await new Promise<void>(resolve=>pending.push(resolve));}
 pause(){this.paused=true;}
}
const elements:FakeAudio[]=[];
Object.assign(globalThis,{document:{createElement:()=>{const el=new FakeAudio();elements.push(el);return el;}}});
const {AudioManager}=await import('../integrations/solar-system-atlas/src/audio/audioManager');
const {resolveTrackUrl}=await import('../integrations/solar-system-atlas/src/audio/musicTracks');
const background={id:'base',title:'Background',order:1,duration:30,file:'',netease:1};
const manager=new AudioManager();manager.setAlbum([background]);await manager.playMusic();
assert.equal(manager.isMusicPlaying(),true);
manager.pauseMusic();delayed.splice(0).forEach(fn=>fn());const before=plays;
await manager.setContextTrack(GRAND_BLUE);
delayed.splice(0).forEach(fn=>fn());assert.ok(elements.every(el=>el.paused),'Changing the context while muted must still stop all previous audio');
assert.equal(plays,before,'Opening a muted Easter egg cannot play or re-enable music');
assert.equal(manager.isMusicEnabled(),false);
assert.equal(manager.getContextTrack()?.title,'Grand Blue');
await manager.setMusicEnabled(true);
assert.ok(elements.some(el=>!el.paused&&el.src==='/audio/easter-eggs/grand-blue.mp3'));
await manager.setContextTrack(WHAT_A_LIFE);delayed.splice(0).forEach(fn=>fn());
assert.equal(manager.getMusicTrack()?.title,'What A Life');
assert.equal(elements.filter(el=>!el.paused).length,1,'A completed transition leaves one song playing');
assert.equal(elements.find(el=>!el.paused)!.src,'/audio/easter-eggs/what-a-life.mp3');
await manager.setContextTrack(null);delayed.splice(0).forEach(fn=>fn());
assert.equal(manager.getMusicTrack()?.id,'base','Leaving the context restores the previous background song');

defer=true;
const a=manager.setContextTrack(GRAND_BLUE),b=manager.setContextTrack(WHAT_A_LIFE),c=manager.setContextTrack(null);
assert.equal(pending.length,3);pending.splice(0).forEach(fn=>fn());await Promise.all([a,b,c]);delayed.splice(0).forEach(fn=>fn());
assert.equal(manager.getMusicTrack()?.id,'base');assert.equal(manager.isMusicPlaying(),true);
assert.equal(elements.filter(el=>!el.paused).length,1,'Stale play promises cannot pause a reused active slot');
const late=manager.setContextTrack(GRAND_BLUE);manager.pauseMusic();pending.splice(0).forEach(fn=>fn());await late;delayed.splice(0).forEach(fn=>fn());
assert.ok(elements.every(el=>el.paused));assert.equal(manager.isMusicEnabled(),false);
manager.pauseMusic();const resumed=manager.setMusicEnabled(true);delayed.splice(0).forEach(fn=>fn());
assert.ok(elements.some(el=>!el.paused),'An old mute timer must not stop a newly enabled pending song');
pending.splice(0).forEach(fn=>fn());await resumed;assert.equal(manager.isMusicPlaying(),true);
elements.find(el=>!el.paused)!.dispatchEvent(new Event('error'));
assert.equal(manager.hasMusicError(),true);assert.ok(elements.every(el=>el.paused));
assert.equal(manager.isMusicEnabled(),true,'Source failure must expose retry without changing the user preference');

const noSelection={kind:null,id:null},palau={kind:'dive' as const,id:'palau-blue-corner'};
assert.equal(musicForContext('dive',noSelection,false),null,'Opening the dive list cannot trigger Grand Blue');
assert.equal(musicForContext('dive',palau,false),null,'A stale Palau selection in the list cannot retrigger it');
assert.equal(musicForContext('dossier',palau,false),GRAND_BLUE);
assert.equal(musicForContext('dossier',{kind:'dive',id:'red-sea-ras-mohammed'},false),null);
assert.equal(musicForContext('dossier',{kind:'species',id:'palau-blue-corner'},false),null);
assert.equal(musicForContext(null,noSelection,true),WHAT_A_LIFE);
assert.equal(musicForContext('winds',noSelection,false),null);
defer=false;
const fullSong=new AudioManager();fullSong.setAlbum([background]);await fullSong.playMusic();
await fullSong.setContextTrack(GRAND_BLUE,true);delayed.splice(0).forEach(fn=>fn());
const complete=elements.find(el=>!el.paused&&el.src===GRAND_BLUE.stream)!;
complete.duration=313.028;complete.currentTime=40;
await fullSong.setContextTrack(null,true);complete.dispatchEvent(new Event('timeupdate'));
delayed.splice(0).forEach(fn=>fn());
assert.equal(fullSong.getContextTrack()?.id,GRAND_BLUE.id,'Closing Palau must keep the full song playing');
assert.equal(complete.paused,false);assert.equal(complete.currentTime,40);assert.equal(complete.volume,.32);
complete.currentTime=312;complete.dispatchEvent(new Event('timeupdate'));
assert.equal(fullSong.getMusicTrack()?.id,GRAND_BLUE.id,'The ending cannot be crossfaded out early');assert.equal(complete.volume,.32);
complete.ended=true;complete.currentTime=complete.duration;complete.paused=true;complete.dispatchEvent(new Event('ended'));
await Promise.resolve();await Promise.resolve();
assert.equal(fullSong.getContextTrack(),null,'Return to background only after the native ended event');
assert.equal(fullSong.getMusicTrack()?.id,'base');

for(const query of ['丹麦','丹麥','Denmark',' denmark ','Danmark'])assert.ok(isDenmark(query));
for(const query of ['丹麦海峡','Denmark Strait','丹','Shanghai'])assert.equal(isDenmark(query),false);
assert.equal(resolveTrackUrl(GRAND_BLUE,'netease',new Map()),'/audio/easter-eggs/grand-blue.mp3');
assert.equal(resolveTrackUrl(WHAT_A_LIFE,'netease',new Map()),'/audio/easter-eggs/what-a-life.mp3');
const {readFile}=await import('node:fs/promises');
for(const track of [GRAND_BLUE,WHAT_A_LIFE]){const file=await readFile('public'+track.file);assert.ok(file.length>100000);assert.equal(file.subarray(0,3).toString(),'ID3','Both local songs must contain playable MP3 audio');}
Object.assign(globalThis,original);
const {serveAudio}=await import('../scripts/audio-files.mjs');
const {Writable}=await import('node:stream'),{once}=await import('node:events'),{stat}=await import('node:fs/promises');
const audioPath='public'+GRAND_BLUE.file,size=(await stat(audioPath)).size;
const request=async(range?:string,method='GET')=>{const chunks:Buffer[]=[];let status=0,headers:any;const res:any=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback();}});res.writeHead=(s:number,h:any)=>{status=s;headers=h;};const done=once(res,'finish');serveAudio({method,headers:range?{range}:{}},res,audioPath,{size},'test');await done;return {status,headers,bytes:Buffer.concat(chunks)};};
const ranged=await request('bytes=0-31');assert.equal(ranged.status,206);assert.equal(ranged.bytes.length,32);assert.equal(ranged.bytes.subarray(0,3).toString(),'ID3');assert.equal(ranged.headers['content-type'],'audio/mpeg');
assert.equal((await request('bytes=-12')).bytes.length,12);
assert.equal((await request('bytes='+size+'-')).status,416);
const head=await request(undefined,'HEAD');assert.equal(head.status,200);assert.equal(head.bytes.length,0);assert.equal(head.headers['content-length'],size);
console.log('Context music: Palau-only/Denmark names and full-song completion, master mute, restoration, rapid switching and late-play cancellation passed.');
