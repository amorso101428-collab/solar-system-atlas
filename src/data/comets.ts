import type { LocalizedText } from './types'

/**
 * 彗星系统（v5 §14）。
 *
 * 轨道用真实的高偏心率轨道要素：半长轴 a、偏心率 e、倾角 i、
 * 升交点黄经 Ω、近日点幅角 ω，以及 J2000 时的平近点角 M0。
 * 视觉半径仍走 visualScale 的 AU → 视觉半径曲线，所以"离太阳多远"这件事是一致的。
 */
export interface CometDef {
  id: string
  name: string
  nameCn: string
  /** 半长轴 AU */
  a: number
  e: number
  /** 倾角 deg */
  i: number
  node: number
  peri: number
  /** J2000 平近点角 deg */
  m0: number
  /** 公转周期（年） */
  periodYears: number
  /** 近日点距离 AU */
  perihelionAu: number
  /** 远日点距离 AU */
  aphelionAu: number
  nucleusKm: number
  mission?: LocalizedText
  note: LocalizedText
  sources: Array<{ title: string; url: string }>
}

const t = (zh: string, en: string): LocalizedText => ({ zh, en })

export const COMETS: CometDef[] = [
  {
    id: 'halley',
    name: '1P/HALLEY',
    nameCn: '哈雷彗星',
    a: 17.834,
    e: 0.96714,
    i: 162.26,
    node: 58.42,
    peri: 111.33,
    m0: 38.4,
    periodYears: 75.32,
    perihelionAu: 0.586,
    aphelionAu: 35.08,
    nucleusKm: 11,
    mission: t('乔托号 1986 年近距离飞掠，最近 596 km', 'Giotto flew within 596 km in 1986'),
    note: t(
      '人类记录最久的周期彗星，逆行轨道（倾角 162°）。下次回归在 2061 年。',
      'The longest-recorded periodic comet, on a retrograde orbit (i = 162°). It returns in 2061.'
    ),
    sources: [
      {
        title: 'JPL Small-Body Database · 1P/Halley',
        url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1P',
      },
    ],
  },
  {
    id: '67p',
    name: '67P/CHURYUMOV-GERASIMENKO',
    nameCn: '67P 楚留莫夫–格拉西缅科彗星',
    a: 3.463,
    e: 0.641,
    i: 7.04,
    node: 50.14,
    peri: 12.78,
    m0: 220.3,
    periodYears: 6.44,
    perihelionAu: 1.243,
    aphelionAu: 5.68,
    nucleusKm: 4.3,
    mission: t(
      '罗塞塔号 2014 年伴飞，菲莱着陆器首次登陆彗核',
      'Rosetta orbited it in 2014; Philae made the first comet-nucleus landing'
    ),
    note: t(
      '双瓣形状的彗核，像一只橡皮鸭。表面覆盖尘埃与冰，喷流随近日点增强。',
      'A bilobed nucleus resembling a rubber duck, with dust and ice jets that strengthen near perihelion.'
    ),
    sources: [
      {
        title: 'NASA · Rosetta 67P imaging the coma',
        url: 'https://science.nasa.gov/photojournal/rosettas-comet-imaging-the-coma/',
      },
    ],
  },
  {
    id: 'encke',
    name: '2P/ENCKE',
    nameCn: '恩克彗星',
    a: 2.2151,
    e: 0.8483,
    i: 11.78,
    node: 334.57,
    peri: 186.55,
    m0: 140.6,
    periodYears: 3.3,
    perihelionAu: 0.336,
    aphelionAu: 4.09,
    nucleusKm: 4.8,
    note: t(
      '周期最短的彗星之一，也是金牛座流星雨的母体。',
      'One of the shortest-period comets, and the parent of the Taurid meteor shower.'
    ),
    sources: [
      {
        title: 'JPL Small-Body Database · 2P/Encke',
        url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=2P',
      },
    ],
  },
  {
    id: 'hale-bopp',
    name: 'C/1995 O1 HALE-BOPP',
    nameCn: '海尔–波普彗星',
    a: 186,
    e: 0.9951,
    i: 89.43,
    node: 282.47,
    peri: 130.59,
    m0: 12.9,
    periodYears: 2534,
    perihelionAu: 0.914,
    aphelionAu: 371,
    nucleusKm: 60,
    note: t(
      '20 世纪最明亮的彗星之一，1997 年肉眼可见长达 18 个月。',
      'One of the brightest comets of the 20th century, visible to the naked eye for 18 months in 1997.'
    ),
    sources: [
      {
        title: 'JPL Small-Body Database · C/1995 O1',
        url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1995%20O1',
      },
    ],
  },
  {
    id: 'wild-2',
    name: '81P/WILD 2',
    nameCn: '维尔特二号彗星',
    a: 3.449,
    e: 0.538,
    i: 3.24,
    node: 136.1,
    peri: 41.79,
    m0: 305.2,
    periodYears: 6.41,
    perihelionAu: 1.59,
    aphelionAu: 5.31,
    nucleusKm: 4,
    mission: t('星尘号 2004 年取样，2006 年带回地球', 'Stardust sampled it in 2004 and returned the samples in 2006'),
    note: t('第一次把彗核物质带回地球的彗星。', 'The first comet whose nucleus material was returned to Earth.'),
    sources: [
      {
        title: 'NASA · Stardust',
        url: 'https://science.nasa.gov/mission/stardust/',
      },
    ],
  },
]

export const COMET_BY_ID = new Map(COMETS.map((comet) => [comet.id, comet]))
