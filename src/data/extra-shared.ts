import type {
  FilterTag,
  GlyphKind,
  LocalizedText,
  ObjectCategory,
  ObjectKind,
  ObjectStatus,
  SpaceObject,
  SystemId,
} from './types'

/**
 * 扩充档案（方案书 §5：航天器数量从 38 扩到 100+）的构造器。
 *
 * 核心 49 个对象在 objects.ts 里逐条手写；这里用统一的构造器补齐到 130 余个，
 * 每个对象的字段仍然逐条人工填写——只是省掉了重复的样板。
 *
 * importance 分层（方案书 §5）：
 *   1 = 主视觉对象，完整档案 + 3D 剪影
 *   2 = 可点可搜，简版档案
 *   3 = 主要承担空间密度，标记很小、默认几乎不出标签
 */

export const t = (zh: string, en: string): LocalizedText => ({ zh, en })

const GLYPH_BY_KIND: Record<ObjectKind, GlyphKind> = {
  satellite: 'dot',
  station: 'station',
  telescope: 'telescope',
  orbiter: 'probe',
  lander: 'capsule',
  rover: 'rover',
  probe: 'probe',
  capsule: 'capsule',
  constellation: 'dot',
}

export interface ExtraSpec {
  id: string
  name: string
  cn: string
  kind: ObjectKind
  cat: ObjectCategory
  sys: SystemId
  date: string
  org: string
  orbit: string
  orbitCn: string
  mission: LocalizedText
  summary: LocalizedText
  au: number
  src: string
  srcTitle?: string
  status?: ObjectStatus
  mass?: string
  vehicle?: string
  period?: string
  imp?: 1 | 2 | 3
  glyph?: GlyphKind
  tags?: FilterTag[]
  /** 完整档案需要的补充事件：[日期, 中文, English] */
  events?: Array<[string, string, string]>
}

export function makeObject(spec: ExtraSpec): SpaceObject {
  const events = (spec.events ?? []).map(([date, zh, en]) => ({ date, text: t(zh, en) }))
  return {
    id: spec.id,
    name: spec.name,
    nameCn: spec.cn,
    kind: spec.kind,
    category: spec.cat,
    system: spec.sys,
    importance: spec.imp ?? 3,
    syntheticOrbit: true,
    glyph: spec.glyph ?? GLYPH_BY_KIND[spec.kind],
    orbitClass: t(spec.orbitCn, spec.orbit),
    launched: spec.date,
    operator: t(spec.org, spec.org),
    status: spec.status ?? 'ACTIVE',
    mission: spec.mission,
    summary: spec.summary,
    why: spec.summary,
    distanceAu: spec.au,
    distanceLabel: t(`${spec.au.toFixed(2)} AU`, `${spec.au.toFixed(2)} AU`),
    specs: {
      mass: spec.mass,
      launchVehicle: spec.vehicle,
      orbitPeriod: spec.period,
    },
    timeline: [{ date: spec.date, text: t('发射', 'Launched') }, ...events],
    tags: spec.tags ?? ['science'],
    imageQuery: `${spec.name} spacecraft`,
    sources: [{ title: spec.srcTitle ?? `${spec.org} — ${spec.name}`, url: spec.src }],
  }
}
