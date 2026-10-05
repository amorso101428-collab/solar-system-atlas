import { useEffect, useRef } from 'react';
import {installUIParticles} from '../lib/uiParticles';
export function UIParticles({disabled=false}:{disabled?:boolean}={}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>installUIParticles(canvas.current,disabled),[disabled]);
 return <canvas ref={canvas} className="ui-particles" aria-hidden="true"/>;
}
