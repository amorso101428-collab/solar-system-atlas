import { useRef, useState } from 'react'
import { KNOWLEDGE } from '../data/knowledge'
import { useAtlasStore } from '../state/atlasStore'
export function KnowledgeReader({id}:{id:string}) {
  return <Reader key={id} id={id}/>
}

function ArticleText({text}:{text:string}) {
  return <>{text.split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph.split(/(\*\*[^*]+\*\*)/g).map((part,j)=>part.startsWith('**')&&part.endsWith('**')?<strong key={j}>{part.slice(2,-2)}</strong>:part)}</p>)}</>
}

function Reader({id}:{id:string}) {
  const root=useRef<HTMLElement>(null)
  const [query,setQuery]=useState('')
  const language=useAtlasStore(s=>s.language)
  const a=KNOWLEDGE[id]
  if(!a)return null
  const zh=language==='zh'
  const search=query.trim().toLocaleLowerCase()
  const sections=a.sections.filter(s=>!search||`${s.title[language]} ${s.body[language]}`.toLocaleLowerCase().includes(search))
  const count=a.sections.reduce((sum,s)=>sum+(zh?s.body.zh.length:s.body.en.trim().split(/\s+/).length),0)
  const expand=(open:boolean)=>root.current?.querySelectorAll<HTMLDetailsElement>('details').forEach(el=>{el.open=open})
  return <section className="archive__section" ref={root}>
    <h4>{language==='zh'?'深入认识这个世界':'EXPLORE THIS WORLD'}</h4>
    <p className="reading-meta">{a.sections.length} {zh?'个章节 · 约':'chapters · ~'} {Math.max(1,Math.round(count/(zh?400:200)))} {zh?'分钟阅读':'min read'}</p>
    <div className="reading-tools">
      <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={zh?'查找本文：大气、地貌、探测…':'Search this article…'} aria-label={zh?'搜索当前天体文章':'Search this body’s article'}/>
      <div><button onClick={()=>expand(true)}>{zh?'展开全部':'Expand all'}</button><button onClick={()=>expand(false)}>{zh?'收起全部':'Collapse all'}</button></div>
    </div>
    {search&&<p className="reading-meta" role="status">{zh?`找到 ${sections.length} 个相关章节`:`${sections.length} matching chapters`}</p>}
    <nav className="reading-chapters" aria-label={zh?'文章章节':'Article chapters'}>{sections.map(s=><button key={s.id} onClick={()=>{const el=Array.from(root.current?.querySelectorAll<HTMLDetailsElement>('details')??[]).find(item=>item.dataset.chapter===s.id);if(el){el.open=true;el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'})}}}>{String(a.sections.indexOf(s)+1).padStart(2,'0')} {s.title[language]}</button>)}</nav>
    <div className="archive__article">{sections.map(s=><details key={s.id} data-chapter={s.id} open={search?true:a.sections.indexOf(s)===0}><summary><span>{s.title[language]}</span><em>{String(a.sections.indexOf(s)+1).padStart(2,'0')}</em></summary><ArticleText text={s.body[language]}/></details>)}</div>
    <div className="reading-chapters reading-sources">{a.sources.map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</div>
  </section>
}
