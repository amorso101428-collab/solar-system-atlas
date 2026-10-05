import { useCallback } from "react";
import { useAtlas, type Locale } from "../state/store";
import { CURRENTS } from "../data/currents";
import { OCEANS } from "../data/oceans";
import { SPECIES } from "../data/species";
import { DIVE_SITES } from "../data/divesites";
import { LESSONS } from "../data/lessons";
import { CONTENT } from "./content";

const en = new Map<string,string>(CONTENT);
const zh = new Map<string,string>();
for (const [a,b] of CONTENT) zh.set(b.toUpperCase(),a);
for (const item of [...CURRENTS,...OCEANS,...SPECIES,...DIVE_SITES]) {
 en.set(item.name_cn,item.name_en); zh.set(item.name_en.toUpperCase(),item.name_cn);
}
for(const lesson of LESSONS){
 en.set(lesson.title_cn,lesson.title_en); zh.set(lesson.title_en,lesson.title_cn);
 for(const step of lesson.steps){ en.set(step.cn,step.label); zh.set(step.label,step.cn); }
}
const tokens: [string,string][] = [
 ["pacific","太平洋"],["atlantic","大西洋"],["indian","印度洋"],["southern","南大洋"],["arctic","北冰洋"],
 ["WARM","暖流"],["COLD","寒流"],["WESTERN BOUNDARY","西边界流"],["EASTERN BOUNDARY","东边界流"],["ZONAL","纬向流"],["CIRCUMPOLAR","绕极流"],
 ["Western Boundary Current","西边界流"],["Eastern Boundary Current","东边界流"],["Zonal Extension","纬向延伸流"],["Circumpolar","绕极流"],["Monsoon-Driven","季风驱动"],
 ["CALM","平静"],["SLIGHT","弱流"],["MODERATE","中等"],["STRONG","强流"],["VERY STRONG","极强流"],
 ["MARINE MAMMAL","海洋哺乳动物"],["FISH","鱼类"],["REPTILE","爬行动物"],["CEPHALOPOD","头足类"],["SEABIRD","海鸟"],["CRUSTACEAN","甲壳类"],["ALGAE","藻类"],
 ["AUSTRALIA","澳大利亚"],["PALAU","帕劳"],["ECUADOR","厄瓜多尔"],["COSTA RICA","哥斯达黎加"],["MALDIVES","马尔代夫"],["EGYPT","埃及"],["MALAYSIA","马来西亚"],["THAILAND","泰国"],["CAYMAN ISLANDS","开曼群岛"],["PHILIPPINES","菲律宾"],["INDONESIA","印度尼西亚"],["USA","美国"],["ICELAND","冰岛"],["SOUTH AFRICA","南非"],
 ["Current","洋流"],["Ocean","海洋"],["GLOBAL","全球"],["OCEAN","大洋"],["REGION","区域"],["LOCAL","局部"],["OBSERVED","观测"],["MODEL","模型"],["DERIVED","派生"],["ESTIMATED","估算"],["SIMULATED","模拟"],
 ["SUMMER","夏季"],["WINTER","冬季"],["COMPARE","对比"],["OFF","关闭"],
 ];
for(const [a,b] of tokens){zh.set(a.toUpperCase(),b);en.set(b,a);}
for(const c of CURRENTS) {
 zh.set(c.name_en.replace(/ CURRENT$/, ""),c.name_cn);
 zh.set(c.name_en.replace(/ CURRENT$/, "").toLowerCase().toUpperCase(),c.name_cn);
}
zh.set("ANTARCTIC CIRCUMPOLAR", "南极绕极流"); zh.set("AGULHAS (INFLOW)","厄加勒斯流入");
zh.set("EAST AUSTRALIAN (ADJACENT)","东澳大利亚邻近水域"); zh.set("EQUATORIAL SYSTEM","赤道流系");
zh.set("ANTARCTIC COASTAL CURRENT","南极沿岸流");zh.set("WEDDELL GYRE","威德尔环流");
zh.set("BEAUFORT GYRE","波弗特环流");zh.set("TRANSPOLAR DRIFT","跨极漂流");zh.set("EAST GREENLAND CURRENT","东格陵兰洋流");
const zhOverrides=new Map<string,string>([
 ["挑战者深渊 Challenger Deep · 马里亚纳海沟","挑战者深渊 · 马里亚纳海沟"],
 ["密尔沃基深渊 Milwaukee Deep · 波多黎各海沟","密尔沃基深渊 · 波多黎各海沟"],
 ["巽他海沟 Sunda Trench","巽他海沟"],
 ["南桑威奇海沟 South Sandwich Trench","南桑威奇海沟"],
 ["莫洛伊深渊 Molloy Deep · 弗拉姆海峡","莫洛伊深渊 · 弗拉姆海峡"],
 ["在厄加勒斯浅滩发生回旋（retroflection）并部分回流，与南极绕极流交换水体。","在厄加勒斯浅滩发生回旋并部分回流，与南极绕极流交换水体。"],
]);
zh.set("CANARY","加那利洋流");zh.set("WEST AUSTRALIAN","西澳大利亚洋流");
const months:Record<string,number>={JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12};
export function translate(value: string, locale: Locale): string {
 if(locale==="en")return en.get(value)??value;
 const result=zh.get(value.toUpperCase())??value;
 return (zhOverrides.get(result)??result).replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[–-](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/g,(_,a:string,b:string)=>`${months[a]}–${months[b]}月`);
}
export function useLanguage() {
 const locale=useAtlas(s=>s.locale);
 const t=useCallback((cn:string,english:string)=>locale==="en"?english:cn,[locale]);
 const text=useCallback((value:string)=>translate(value,locale),[locale]);
 const name=useCallback((item:{name_cn:string;name_en:string})=>locale==="en"?item.name_en:item.name_cn,[locale]);
 return {locale,t,text,name};
}
