import {READING} from '../data/reading';
import {useLanguage} from '../i18n';
export default function ScienceReading({kind,compact=false}:{kind:keyof typeof READING;compact?:boolean}){
 const {locale,t}=useLanguage();
 return <div className={'science-reading'+(compact?' is-compact':'')}>
  {!compact&&<header className="reading-heading"><span className="eyebrow">{t('海洋图谱 · 延伸阅读','Ocean atlas · Further reading')}</span><h1>{kind==='earth'?t('认识蓝色星球','The blue planet'):kind==='sky'?t('太空与海洋之间','Between space and ocean'):kind==='currents'?t('海洋的运动','The moving ocean'):t('海洋生命','Life in the ocean')}</h1></header>}
  {READING[kind].map((c,i)=><section key={i} className="reading-chapter"><h3>{c.title[locale]}</h3>{c.paragraphs.map((p,j)=><p key={j}>{p[locale]}</p>)}{c.source&&<a className="reading-source" href={c.source.url} target="_blank" rel="noreferrer">{c.source.name} ↗</a>}</section>)}
 </div>;
}
