export interface Quote {
  text: string;
  author: string;
  meta: string;
  source: string;
}

/**
 * Attribution checked. The Alexander von Humboldt line that circulates with
 * this wording has a disputed origin (Quote Investigator), so it is not used.
 */
export const QUOTES: Quote[] = [
  {
    text: "丈夫当朝碧海而暮苍梧，岂以一隅自限耶？",
    author: "徐霞客",
    meta: "明 · 地理学家、旅行家",
    source: "《徐霞客游记》",
  },
  {
    text: "天下之水，莫大于海，万川归之，不知何时止而不盈。",
    author: "庄子",
    meta: "战国 · 秋水",
    source: "《庄子·秋水》",
  },
  {
    text: "东流不溢，孰知其故？",
    author: "屈原",
    meta: "战国 · 天问",
    source: "《楚辞·天问》",
  },
  {
    text: "栖居于大地之美与奥秘之中的人，永不孤独。",
    author: "蕾切尔·卡森",
    meta: "Rachel Carson · 海洋生物学家",
    source: "《惊奇之心》",
  },
];
