import type {AlbumTrack} from '../../integrations/solar-system-atlas/src/audio/musicTracks';
import type {Panel,Selection} from '../state/store';

export const GRAND_BLUE:AlbumTrack={
 id:'egg-grand-blue',title:'Grand Blue',artist:'湘南乃風（しょうなんのかぜ）',order:0,duration:313,file:'/audio/easter-eggs/grand-blue.mp3',userFile:true,
 stream:'/audio/easter-eggs/grand-blue.mp3',
 bandcamp:'https://music.apple.com/jp/album/grand-blue/1391490753?i=1391490760',
};
export const WHAT_A_LIFE:AlbumTrack={
 id:'egg-what-a-life',title:'What A Life',artist:'Scarlet Pleasure',order:0,duration:185,file:'/audio/easter-eggs/what-a-life.mp3',userFile:true,stream:'/audio/easter-eggs/what-a-life.mp3',
 bandcamp:'https://music.163.com/song?id=1839410613',
};
export function isDenmark(value:string){return /^(丹麦|丹麥|denmark|danmark)$/i.test(value.trim());}
export function musicForContext(panel:Panel,selection:Selection,denmark:boolean):AlbumTrack|null {
 if(panel==='dossier'&&selection.kind==='dive'&&selection.id==='palau-blue-corner')return GRAND_BLUE;
 return denmark?WHAT_A_LIFE:null;
}
