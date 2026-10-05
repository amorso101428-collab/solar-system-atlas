import {OCEANS} from '../data/oceans';
export type PlaceKind='continent'|'ocean'|'country'|'city'|'region'|'nature'|'road'|'poi'|'current'|'wind';
export interface PlaceLabel {id:string;kind:PlaceKind;cn:string;en:string;lon:number;lat:number;rank:number;minZoom:number;maxZoom?:number;population?:number;oceanId?:string;subtitle?:{cn:string;en:string};}
const continents:[string,string,number,number][]=[['亚洲','Asia',88,42],['欧洲','Europe',22,50],['非洲','Africa',22,3],['北美洲','North America',-105,43],['南美洲','South America',-60,-18],['大洋洲','Oceania',135,-25],['南极洲','Antarctica',30,-74]];
const oceanAnchors:Record<string,[number,number]>={atlantic:[-15,-8],indian:[65,-20]};
export const GLOBAL_LABELS:PlaceLabel[]=[
 ...continents.map(([cn,en,lon,lat],i)=>({id:'continent:'+i,kind:'continent' as const,cn,en,lon,lat,rank:0,minZoom:0,maxZoom:4.4})),
 ...OCEANS.map(o=>({id:'ocean:'+o.id,kind:'ocean' as const,oceanId:o.id,cn:o.name_cn,en:o.name_en,lon:oceanAnchors[o.id]?.[0]??o.lon,lat:oceanAnchors[o.id]?.[1]??o.lat,rank:1,minZoom:0,maxZoom:5.8})),
 {id:'ocean:pacific-east',oceanId:'pacific',kind:'ocean',cn:'太平洋',en:'Pacific Ocean',lon:164,lat:5,rank:1,minZoom:0,maxZoom:5.8},
];
const features:[string,string,number,number,number][]=[
 ['地中海','Mediterranean Sea',18,36,4],['加勒比海','Caribbean Sea',-75,15,4],['阿拉伯海','Arabian Sea',64,15,4],['孟加拉湾','Bay of Bengal',88,15,4],['南海','South China Sea',113,14,4],['红海','Red Sea',38,21,5],['北海','North Sea',3,56,5],['波罗的海','Baltic Sea',20,58,5],['白令海','Bering Sea',-174,57,4],['撒哈拉沙漠','Sahara Desert',15,24,4],['亚马孙盆地','Amazon Basin',-60,-5,4],['格陵兰岛','Greenland',-42,74,4],['喜马拉雅山脉','Himalayas',84,29,5],['安第斯山脉','Andes',-70,-24,5],['阿尔卑斯山脉','Alps',10,47,5],['尼罗河','Nile',31,21,5],['密西西比河','Mississippi River',-91,35,5],['北美五大湖','Great Lakes',-85,45,5],['大堡礁','Great Barrier Reef',147,-19,6],['珠穆朗玛峰','Mount Everest',86.925,27.988,8],['勃朗峰','Mont Blanc',6.865,45.833,8],['大峡谷','Grand Canyon',-112.113,36.096,7],
];
export const FEATURE_LABELS:PlaceLabel[]=features.map(([cn,en,lon,lat,minZoom],i)=>({id:'nature:'+i,kind:'nature',cn,en,lon,lat,rank:2,minZoom,maxZoom:minZoom>=7?16:10}));
export function normalizePlaceLabel(p:PlaceLabel):PlaceLabel {
 return p.id==='country:TWN'||/^(台湾|台灣|中华民国|中華民國|Taiwan|Republic of China)$/i.test(p.cn)||/^(Taiwan|Republic of China)$/i.test(p.en)?{...p,cn:'台湾',en:'Taiwan'}:p;
}
export function labelText(p:PlaceLabel,locale:string){const name=normalizePlaceLabel(p);return locale==='en'?name.en:name.cn;}
// Some providers put an untranslated non-Latin name in the English/Latin field.
export function hasEnglishLabel(name:string){return /\p{Script=Latin}/u.test(name)&&!(/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(name));}
export function labelZoom(eyeHeight:number,pixels:number,latitude:number,scaleMeters=0) {
 const metresPerPixel=scaleMeters>0?scaleMeters/100:Math.max(1,eyeHeight)*1.155/Math.max(1,pixels);
 return Math.max(0,Math.min(20,Math.log2(156543.03392*Math.max(.18,Math.cos(latitude*Math.PI/180))/Math.max(.05,metresPerPixel))));
}
export function eligibleLabel(p:PlaceLabel,zoom:number) {
 const {min,max}=labelRange(p);return zoom>=min&&zoom<max;
}
/** Scale selects which names exist, never their screen font size. Smaller
 * settlements enter after capitals, with a quiet fade at each tier boundary. */
export function labelRange(p:PlaceLabel){
 let min=p.minZoom,max=p.maxZoom??21;
 if(p.kind==='country'){min=Math.max(min,3.8);max=Math.min(max,8.5);}
 if(p.kind==='city'){min=Math.max(min,p.rank<=3?5.4:p.rank<=7?7:9);max=Math.min(max,p.rank<=3?21:16);}
 if(p.kind==='region')min=Math.max(min,9);
 if(p.kind==='road')min=Math.max(min,13);
 if(p.kind==='poi')min=Math.max(min,14);
 return {min,max};
}
export function labelOpacity(p:PlaceLabel,zoom:number){
 const {min,max}=labelRange(p);if(zoom<min||zoom>=max)return 0;
 return Math.min(1,p.kind==='current'||min===0?1:(zoom-min)/.35,(max-zoom)/.35);
}
export const labelFontSize=12;
export function labelBudget(width:number,height:number){return Math.max(10,Math.min(width<700?22:48,Math.floor(width*height/18000)));}
export interface LabelBox {left:number;top:number;right:number;bottom:number;}
export function boxesOverlap(a:LabelBox,b:LabelBox,padding=7){return a.left<b.right+padding&&a.right>b.left-padding&&a.top<b.bottom+padding&&a.bottom>b.top-padding;}
export function inGeographicBounds(lon:number,lat:number,bounds:{west:number;east:number;south:number;north:number}|undefined) {
 if(!bounds)return true;
 return lat>=bounds.south&&lat<=bounds.north&&(bounds.east>=bounds.west?lon>=bounds.west&&lon<=bounds.east:lon>=bounds.west||lon<=bounds.east);
}
const category:Record<PlaceKind,[string,string]>={wind:['风带／季风','WIND BELT / MONSOON'],current:['洋流','CURRENT'],continent:['大陆','CONTINENT'],ocean:['大洋','OCEAN'],country:['国家／地区','COUNTRY / REGION'],city:['城市','CITY'],region:['地区','REGION'],nature:['地理地貌','GEOGRAPHY'],road:['道路','ROAD'],poi:['地标','PLACE']};
export const labelCategory=(kind:PlaceKind,locale:string)=>category[kind][locale==='en'?1:0];
