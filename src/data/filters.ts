import type { FilterDef, SpaceObject } from './types'

const operatorText = (object: SpaceObject) => `${object.operator.en} ${object.operator.zh}`.toLowerCase()

/**
 * 卫星种类筛选（方案书 §15 OBJECTS）。
 *
 * 这些是**显示筛选**，不是网页跳转：命中之外的对象不会消失，只是退成背景密度，
 * 所以切换时画面不会突然空掉。
 */
export const CATEGORY_FILTERS: FilterDef[] = [
  { id: 'ALL', label: 'ALL', match: () => true },
  {
    id: 'EXPLORATION',
    label: 'EXPLORATION',
    match: (o) =>
      o.tags.includes('planetary') ||
      ['probe', 'rover', 'lander', 'orbiter'].includes(o.kind),
  },
  {
    id: 'OBSERVATION',
    label: 'OBSERVATION',
    match: (o) => o.kind === 'telescope' || o.tags.includes('astronomy'),
  },
  {
    id: 'TELECOM',
    label: 'TELECOM',
    match: (o) => o.tags.includes('comms') || /telecom|communication|comsat/i.test(o.orbitClass.en),
  },
  {
    id: 'NAVIGATION',
    label: 'NAVIGATION',
    match: (o) => o.tags.includes('navigation') || /navigation|gps|galileo|glonass|beidou/i.test(o.orbitClass.en),
  },
  {
    id: 'SPACE STATION',
    label: 'SPACE STATION',
    match: (o) => o.kind === 'station' || /space station|salyut|skylab|mir\b/i.test(o.name),
  },
  {
    id: 'STARLINK',
    label: 'STARLINK',
    match: (o) => /starlink|星链/i.test(`${o.id} ${o.name} ${o.nameCn}`),
  },
  {
    id: 'NASA',
    label: 'NASA',
    match: (o) => operatorText(o).includes('nasa'),
  },
  {
    id: 'ESA',
    label: 'ESA',
    match: (o) => /esa|european space agency|欧洲空间局|欧洲航天局/.test(operatorText(o)),
  },
  {
    /**
     * 中国航天（v8 §38 / §41）：与 NASA / ESA 同级的机构分类。
     * 判据同时看机构名与任务名，避免"嫦娥 / 天问"这类由中国国家航天局主导、
     * 但 operator 里没有英文缩写的情况漏掉。
     */
    id: 'CHINA_SPACE',
    label: 'CHINA SPACE',
    match: (o) =>
      /china|cnsa|cmsa|cmse|beidou|casc|中国|北斗|嫦娥|天问|鹊桥|天宫|神舟|天舟|祝融|东方红|高分|风云|海洋/.test(
        `${o.id} ${o.name} ${o.nameCn} ${o.mission.en} ${o.mission.zh} ${operatorText(o)}`
      ),
  },
  {
    id: 'OTHER',
    label: 'OTHER',
    match: (o) => {
      const known = [
        'EXPLORATION',
        'OBSERVATION',
        'TELECOM',
        'NAVIGATION',
        'SPACE STATION',
        'STARLINK',
        'NASA',
        'ESA',
      ].some((id) => CATEGORY_FILTER_BY_ID.get(id)?.match(o))
      return !known
    },
  },
]

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
