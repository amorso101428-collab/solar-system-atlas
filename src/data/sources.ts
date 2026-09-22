/**
 * 数据与素材来源登记（v5 §20 / §28）。
 *
 * 页面底部必须直接显示这些信息，不能只写在 README 里。
 * 任何新增的外部数据 / 图片都要在这里登记：来源、链接、许可。
 */

/** 本轮数据的抓取 / 计算日期 */
export const RETRIEVED_AT = '2026-09-21'

export interface SourceEntry {
  name: string
  url: string
  note?: string
}

export const SOURCES = {
  horizons: {
    name: 'JPL Horizons (v4.98e)',
    url: 'https://ssd.jpl.nasa.gov/horizons/',
    note: '行星 / 卫星 / 彗星的星历与轨道要素',
  },
  spice: {
    name: 'NAIF SPICE · IAU WGCCRE',
    url: 'https://naif.jpl.nasa.gov/naif/',
    note: '自转轴、本初子午线与自转速率（PCK 体系）',
  },
  nasa: {
    name: 'NASA / JPL Photojournal',
    url: 'https://science.nasa.gov/photojournal/',
    note: '行星与卫星影像、土星环结构参考',
  },
  sdo: {
    name: 'NASA SDO (HMI / AIA)',
    url: 'https://sdo.gsfc.nasa.gov/data/',
    note: '日面白光与多波段太阳图像',
  },
  usgs: {
    name: 'USGS Astrogeology',
    url: 'https://astrogeology.usgs.gov/',
    note: '卫星全球镶嵌图（等距圆柱投影）',
  },
  sss: {
    name: 'Solar System Scope (CC BY 4.0)',
    url: 'https://www.solarsystemscope.com/textures/',
    note: '行星 2K 贴图与土星环 alpha 图',
  },
  celestrak: {
    name: 'CelesTrak GP',
    url: 'https://celestrak.org/',
    note: '地球在轨目标目录（TLE → 平均轨道要素）',
  },
  mission: {
    name: 'NASA / ESA 任务档案',
    url: 'https://science.nasa.gov/missions/',
    note: '航天器任务参数与里程碑',
  },
} satisfies Record<string, SourceEntry>

export type SourceKey = keyof typeof SOURCES
