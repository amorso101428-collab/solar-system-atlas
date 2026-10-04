import { useAtlasStore } from '../state/atlasStore'
import { useExperience, cameraCommand } from '../state/experience'
import { PLANETS } from '../data/planets'
import { audio } from '../audio/audioManager'
export function BodyObservation({id}:{id:string}) {
 const zh=useAtlasStore(s=>s.language)==='zh'
 const labels=useExperience(s=>s.annotations)
 const observation=useExperience(s=>s.observation)
 const bodies=['sun',...PLANETS.map(p=>p.id)]
 const index=bodies.indexOf(id)
 const move=(step:number)=>{audio.emit('object.focus');useAtlasStore.getState().focusPlanet(bodies[(index+step+bodies.length)%bodies.length])}
 return <section className="body-observation">
   <div className="archive__label">{zh?'观察这个世界':'OBSERVE THIS WORLD'}</div>
   {id!=='sun' && <div className="catalogpanel__tabs">{['day','terminator','night'].map((a,i)=><button key={a} aria-pressed={observation===a} onClick={()=>{cameraCommand(a);audio.emit('view.change')}}>{zh?['向阳面','晨昏线','背光面'][i]:['Day side','Terminator','Night side'][i]}</button>)}</div>}
   <div className="observation-navigation">
     {index>=0 && <button onClick={()=>move(-1)}>← {zh?'上一颗':'Previous'}</button>}
     <button aria-pressed={labels} onClick={()=>useExperience.setState({annotations:!labels})}>{zh?(labels?'收起标注':'地理标注'):'Geographic labels'}</button>
     {index>=0 && <button onClick={()=>move(1)}>{zh?'下一颗':'Next'} →</button>}
   </div>
 </section>
}
