import {useEffect,useRef,useState,type CSSProperties,type PointerEvent,type KeyboardEvent} from 'react';
import {useLanguage} from '../i18n';
import {QUALITY_STOPS,snapQuality,type Quality} from '../lib/quality';

/** Drag the optical lens continuously; commit expensive render changes once. */
export default function QualitySlider({value,onChange,reduced}:{value:Quality;onChange:(quality:Quality)=>void;reduced:boolean}){
 const {t}=useLanguage(),index=QUALITY_STOPS.indexOf(value);
 const [position,setPosition]=useState(index),[dragging,setDragging]=useState(false);
 const draft=useRef(index),pointer=useRef<number|null>(null);
 useEffect(()=>{if(pointer.current===null){draft.current=index;setPosition(index);}},[index]);
 const labels=[t('低','Low'),t('中','Medium'),t('高','High')];
 const commit=(p:number)=>{const snapped=snapQuality(p);draft.current=snapped.index;setPosition(snapped.index);onChange(snapped.quality);};
 const move=(e:PointerEvent<HTMLDivElement>)=>{const box=e.currentTarget.getBoundingClientRect();const p=Math.max(0,Math.min(2,(e.clientX-box.left-22)/Math.max(1,box.width-44)*2));draft.current=p;setPosition(p);};
 const down=(e:PointerEvent<HTMLDivElement>)=>{if(!e.isPrimary||e.button!==0)return;e.preventDefault();pointer.current=e.pointerId;e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);move(e);};
 const finish=(e:PointerEvent<HTMLDivElement>,cancel=false)=>{if(pointer.current!==e.pointerId)return;pointer.current=null;setDragging(false);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);commit(cancel?index:draft.current);};
 const key=(e:KeyboardEvent<HTMLDivElement>)=>{const i=snapQuality(draft.current).index;const p=e.key==='Home'?0:e.key==='End'?2:['ArrowRight','ArrowUp'].includes(e.key)?i+1:['ArrowLeft','ArrowDown'].includes(e.key)?i-1:null;if(p!==null){e.preventDefault();commit(p);}};
 return <section className="quality-control" aria-label={t('画质设置','Render quality settings')}>
  <div className="quality-control__heading"><h3 id="quality-heading">{t('画质','Render quality')}</h3><span>{labels[index]}</span></div>
  <div className="quality-slider" role="slider" tabIndex={0} aria-labelledby="quality-heading" aria-valuemin={0} aria-valuemax={2} aria-valuenow={snapQuality(position).index} aria-valuetext={labels[snapQuality(position).index]} aria-orientation="horizontal" data-dragging={dragging} data-reduced={reduced} style={{'--quality-position':position/2} as CSSProperties}
   onPointerDown={down} onPointerMove={e=>{if(pointer.current===e.pointerId)move(e);}} onPointerUp={e=>finish(e)} onPointerCancel={e=>finish(e,true)} onLostPointerCapture={e=>finish(e,true)} onKeyDown={key}>
   <div className="quality-slider__rail"><i/><i/><i/><span className="quality-slider__fill"/><span className="quality-slider__lens"/></div>
  </div>
  <div className="quality-slider__labels">{labels.map((label,i)=><button key={i} aria-label={t('画质：','Quality: ')+label} aria-pressed={i===index} onClick={()=>commit(i)}>{label}</button>)}</div>
  <p className="quality-control__hint">{t('拖动后吸附至三档 · 松开应用','Snaps to three levels · Release to apply')}</p>
 </section>;
}
