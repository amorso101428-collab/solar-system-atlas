import type { FilterDef, SpaceObject } from './types'
export const CATEGORY_FILTERS: FilterDef[] = [
  {id:'ALL',label:'全部任务',match:()=>true},
  {id:'SATELLITES',label:'人造卫星',match:o=>['satellite','constellation'].includes(o.kind)},
  {id:'CREWED',label:'载人航天',match:o=>['station','capsule'].includes(o.kind)},
  {id:'PROBES',label:'轨道器与探测器',match:o=>['probe','orbiter'].includes(o.kind)},
  {id:'LANDERS',label:'着陆器与巡视器',match:o=>['lander','rover'].includes(o.kind)},
  {id:'TELESCOPES',label:'空间望远镜',match:o=>o.kind==='telescope'},
]
const EN: Record<string,string> = {ALL:'All missions',SATELLITES:'Satellites',CREWED:'Human spaceflight',PROBES:'Orbiters & probes',LANDERS:'Landers & rovers',TELESCOPES:'Space telescopes'}
export function categoryLabel(id:string,language:string):string {return language==='zh' ? CATEGORY_FILTERS.find(f=>f.id===id)?.label ?? id : EN[id] ?? id}

export const CATEGORY_FILTER_BY_ID = new Map(
  CATEGORY_FILTERS.map((filter) => [filter.id, filter])
)

export const FILTERS: FilterDef[] = [
  { id: 'ALL', label: 'ALL', match: () => true },
  { id: 'EARTH', label: 'EARTH', match: (o: SpaceObject) => o.category === 'EARTH' },
  { id: 'MOON', label: 'MOON', match: (o: SpaceObject) => o.category === 'MOON' },
  { id: 'MARS', label: 'MARS', match: (o: SpaceObject) => o.category === 'MARS' },
  {
    id: 'DEEP SPACE',
    label: 'DEEP SPACE',
    match: (o: SpaceObject) => o.category === 'DEEP_SPACE' || o.category === 'OUTER',
  },
  {
    id: 'SCIENCE',
    label: 'SCIENCE',
    match: (o: SpaceObject) => o.tags.includes('science') || o.tags.includes('astronomy'),
  },
  {
    id: 'HUMAN HABITAT',
    label: 'HUMAN HABITAT',
    match: (o: SpaceObject) => o.tags.includes('crewed'),
  },
  {
    id: 'HISTORICAL',
    label: 'HISTORICAL',
    match: (o: SpaceObject) => o.tags.includes('historical'),
  },
]

export const FILTER_BY_ID = new Map(
  [...FILTERS, ...CATEGORY_FILTERS].map((filter) => [filter.id, filter])
)
