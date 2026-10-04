import { PLANETS } from './planets'

/**
 * 天体选择器的清单：太阳 + 九大行星，按真实轨道半径排列。
 *
 * 只保留三样东西——名字、识别色、真实 AU。颜色点让人一眼认出是哪颗，
 * AU 让内外顺序可读。点击之后走的是 store 的 `focusPlanet()`，
 * 也就是与搜索、深链（`?body=`）完全相同的那条聚焦路径，不另起一套镜头逻辑。
 */
export interface WorldEntry {
  id: string
  en: string
  cn: string
  color: string
  /** 真实轨道半径（AU）；太阳为 0 */
  au: number
}

export const WORLDS: WorldEntry[] = [
  { id: 'sun', en: 'THE SUN', cn: '太阳', color: '#ffbe63', au: 0 },
  ...PLANETS.map((planet) => ({
    id: planet.id,
    en: planet.name,
    cn: planet.nameCn,
    color: planet.color,
    au: planet.realAu,
  })),
]
