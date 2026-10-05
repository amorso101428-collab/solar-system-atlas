import {useEffect,useId,useRef,useState} from 'react';
import {useLanguage} from '../i18n';
import {useAtlas} from '../state/store';
export default function ArchiveContents({identity}:{identity:string}){
 const ref=useRef<HTMLElement>(null),lastIdentity=useRef(identity),{t}=useLanguage(),reduced=useAtlas(s=>s.reducedMotion);
 const inset=(body:HTMLElement)=>{const rail=ref.current?.getBoundingClientRect(),box=body.getBoundingClientRect();return rail&&rail.width>box.width*.8?Math.max(12,rail.bottom-box.top+12):12;};
 const [chapters,setChapters]=useState<{node:HTMLElement;title:string}[]>([]),[active,setActive]=useState(0),[progress,setProgress]=useState(0);
 const [expanded,setExpanded]=useState(false),listId=useId();
 useEffect(()=>{const body=ref.current?.closest('aside')?.querySelector<HTMLElement>('.workspace-panel__body');if(!body)return;
  const measure=()=>{const rail=ref.current,panel=rail?.closest('aside');if(rail&&panel)rail.style.setProperty('--contents-menu-height',`${Math.max(0,panel.getBoundingClientRect().bottom-rail.getBoundingClientRect().bottom-28)}px`);const list=Array.from(body.querySelectorAll<HTMLElement>('h1,h3'));setChapters(old=>old.length===list.length&&old.every((h,i)=>h.node===list[i]&&h.title===(list[i].tagName==='H1'?t('概览','Overview'):list[i].textContent))?old:list.map(node=>({node,title:node.tagName==='H1'?t('概览','Overview'):node.textContent||""})));const edge=body.getBoundingClientRect().top+inset(body)+28;let current=0;list.forEach((h,i)=>{if(h.getBoundingClientRect().top<=edge)current=i;});setActive(current);const range=body.scrollHeight-body.clientHeight;setProgress(range>1?Math.round(body.scrollTop/range*100):100);};
  if(lastIdentity.current!==identity)body.scrollTop=0;lastIdentity.current=identity;measure();const observer=new MutationObserver(measure);observer.observe(body,{childList:true,subtree:true,characterData:true});const resize=new ResizeObserver(measure);resize.observe(body);body.addEventListener('scroll',measure,{passive:true});return()=>{observer.disconnect();resize.disconnect();body.removeEventListener('scroll',measure);};
 },[identity,t]);
 useEffect(()=>{if(!expanded)return;const list=ref.current?.querySelector<HTMLElement>('ol'),button=list?.querySelector<HTMLElement>('button[aria-current]');if(!list||!button||list.clientHeight===0)return;const row=list.getBoundingClientRect(),item=button.getBoundingClientRect();if(item.top<row.top+8||item.bottom>row.bottom-8)list.scrollTo({top:Math.max(0,list.scrollTop+item.top-row.top-8),behavior:'auto'});},[expanded,active,chapters]);
 useEffect(()=>setExpanded(false),[identity]);
 useEffect(()=>{if(!expanded)return;const outside=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setExpanded(false);};const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setExpanded(false);ref.current?.querySelector<HTMLButtonElement>('.contents-toggle')?.focus();}};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};},[expanded]);
 function jump(h:HTMLElement){setExpanded(false);const body=h.closest<HTMLElement>('.workspace-panel__body');if(body)body.scrollTo({top:body.scrollTop+h.getBoundingClientRect().top-body.getBoundingClientRect().top-inset(body),behavior:reduced?'auto':'smooth'});}
 return <nav className="archive-contents" ref={ref} data-expanded={expanded} aria-label={t('档案章节总纲','Archive table of contents')}>
  <div className="contents-label">{t('总纲','CONTENTS')}<small>{progress}%</small></div>
  <button type="button" className="contents-toggle" aria-expanded={expanded} aria-controls={listId} aria-label={expanded?t('收起章节目录','Close chapter menu'):t('展开章节目录','Open chapter menu')} onClick={()=>setExpanded(value=>!value)}>
   <span className="contents-toggle-label">{t('章节目录','CHAPTERS')}<small>{chapters.length} {t('章','chapters')} · {progress}%</small></span>
   <span className="contents-current"><span>{String(active+1).padStart(2,'0')}</span><span>{chapters[active]?.title||t('概览','Overview')}</span></span>
   <i aria-hidden>{expanded?'−':'+'}</i>
  </button>
  <ol id={listId}>{chapters.map((h,i)=><li key={i}><button aria-current={active===i?'location':undefined} onClick={()=>jump(h.node)}><span>{String(i+1).padStart(2,'0')}</span><span className="contents-title" title={h.title}>{h.title}</span></button></li>)}</ol>
 </nav>;
}
