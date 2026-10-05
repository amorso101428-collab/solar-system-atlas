export interface OceanDossier {
  id: string; name_en: string; name_cn: string; etymology: string;
  areaMkm2: number; volumeMkm3: number; meanDepth: number; maxDepth: number; deepestPoint: string;
  salinity: string; surfaceTemp: string; deepTemp: string;
  coastlineKm: number; currents: string[]; speciesCount: string; endemics: string;
  tectonics: string; forms: string[]; ecology: string[]; human: string;
  lon: number; lat: number;
  source: string;
}

export const OCEANS: OceanDossier[] = [
  {
    id: "pacific", name_en: "PACIFIC OCEAN", name_cn: "太平洋", etymology: "1520 年麦哲伦称其为 Mar Pacífico（平静之海）",
    areaMkm2: 165.25, volumeMkm3: 669.9, meanDepth: 3970, maxDepth: 10924, deepestPoint: "挑战者深渊 Challenger Deep · 马里亚纳海沟",
    salinity: "34.5–35.0 PSU", surfaceTemp: "19–22 °C", deepTemp: "1–4 °C",
    coastlineKm: 135663, currents: ["Kuroshio", "California", "Peru / Humboldt", "Equatorial System", "Antarctic Circumpolar"],
    speciesCount: "约 9 万种已描述（WoRMS 口径）", endemics: "珊瑚三角区为全球海洋生物多样性中心",
    tectonics: "环太平洋火山地震带，全球最深的俯冲带海沟群",
    forms: ["大陆架", "大陆坡", "深海平原", "海沟", "海岭", "海山", "海底热泉"],
    ecology: ["珊瑚三角区", "上升流渔场", "深海热泉", "开放大洋"],
    human: "沿岸 50+ 国家/地区，全球最大渔业产量，全球最繁忙航运通道",
    lon: -150, lat: 0, source: "NOAA / IHO / WoRMS",
  },
  {
    id: "atlantic", name_en: "ATLANTIC OCEAN", name_cn: "大西洋", etymology: "源自希腊 Atlas（擎天神）",
    areaMkm2: 85.13, volumeMkm3: 310.4, meanDepth: 3646, maxDepth: 8376, deepestPoint: "密尔沃基深渊 Milwaukee Deep · 波多黎各海沟",
    salinity: "35.0–37.0 PSU", surfaceTemp: "17–20 °C", deepTemp: "1–4 °C",
    coastlineKm: 111866, currents: ["Gulf Stream", "Labrador", "North Atlantic Drift", "Canary", "Benguela", "Agulhas (inflow)"],
    speciesCount: "约 6 万种已描述", endemics: "马尾藻海特有种群",
    tectonics: "大西洋中脊纵贯南北，全球最长的海底山脉",
    forms: ["大陆架", "大陆坡", "深海平原", "中洋脊", "海沟", "海底峡谷"],
    ecology: ["马尾藻海", "冷泉生态", "珊瑚礁（加勒比）", "鲸类洄游通道"],
    human: "全球最繁忙的航运与渔业海区之一，北大西洋温盐环流的关键段",
    lon: -30, lat: 20, source: "NOAA / IHO / WoRMS",
  },
  {
    id: "indian", name_en: "INDIAN OCEAN", name_cn: "印度洋", etymology: "以印度命名的古代航路之海",
    areaMkm2: 70.56, volumeMkm3: 264.0, meanDepth: 3741, maxDepth: 7290, deepestPoint: "巽他海沟 Sunda Trench",
    salinity: "34.5–35.0 PSU", surfaceTemp: "22–25 °C", deepTemp: "1–3 °C",
    coastlineKm: 66526, currents: ["Agulhas", "West Australian", "East Australian (adjacent)", "Equatorial System", "Somali"],
    speciesCount: "约 5 万种已描述", endemics: "西印度洋与红海高特有性",
    tectonics: "90° 东海岭与巽他弧，季风驱动最强上升流系统之一",
    forms: ["大陆架", "深海扇", "海岭", "海沟", "海山"],
    ecology: ["季风上升流", "珊瑚礁", "红树林", "鲸类繁殖场"],
    human: "全球最暖海洋，季风控制航运与渔业节律",
    lon: 76, lat: -30, source: "NOAA / IHO / WoRMS",
  },
  {
    id: "southern", name_en: "SOUTHERN OCEAN", name_cn: "南大洋", etymology: "2000 年 IHO 定义、以 60°S 为界的环极水体（边界仍有争议）",
    areaMkm2: 21.96, volumeMkm3: 71.8, meanDepth: 3270, maxDepth: 7236, deepestPoint: "南桑威奇海沟 South Sandwich Trench",
    salinity: "34.5–35.0 PSU", surfaceTemp: "−2 – 10 °C", deepTemp: "0–2 °C",
    coastlineKm: 17968, currents: ["Antarctic Circumpolar Current", "Antarctic Coastal Current", "Weddell Gyre"],
    speciesCount: "约 2 万种已描述", endemics: "南极特有种比例极高的底栖与冰藻系统",
    tectonics: "南极绕极流连通三大洋，全球最强的洋流系统",
    forms: ["海冰", "冰架", "大陆架", "深海平原", "海沟"],
    ecology: ["海冰生态", "磷虾带", "极地上升流", "鲸类摄食场"],
    human: "磷虾渔业与 CCAMLR 保护机制，全球气候关键区",
    lon: 20, lat: -58, source: "IHO / CCAMLR / WoRMS",
  },
  {
    id: "arctic", name_en: "ARCTIC OCEAN", name_cn: "北冰洋", etymology: "希腊 arktos（熊），指大熊座方向",
    areaMkm2: 14.06, volumeMkm3: 18.07, meanDepth: 1205, maxDepth: 5550, deepestPoint: "莫洛伊深渊 Molloy Deep · 弗拉姆海峡",
    salinity: "30.0–34.0 PSU", surfaceTemp: "−2 – 6 °C", deepTemp: "−1 – 1 °C",
    coastlineKm: 45389, currents: ["Beaufort Gyre", "Transpolar Drift", "East Greenland Current"],
    speciesCount: "约 1.5 万种已描述", endemics: "冰依赖型物种多，特有种群集中于中央北极",
    tectonics: "罗蒙诺索夫海岭将海盆分为欧亚与北美两个盆地",
    forms: ["大陆架（占比最高）", "海冰", "海岭", "深海平原", "海冰间湖"],
    ecology: ["海冰生态", "冰藻", "底栖", "极地上升流"],
    human: "航道变化最敏感区域，油气与航运利益集中",
    lon: -20, lat: 82, source: "NOAA / IHO / WoRMS",
  },
];

export const OCEAN_TOTALS = { areaMkm2: 361.9, volumeMkm3: 1335, meanDepth: 3682, salinity: "35 PSU", surfaceTemp: "17–21 °C" };

/** Seawater composition per kg at 35 PSU. */
export const SEAWATER = [
  { ion: "H₂O 水", g: 965.0, pct: 96.5 },
  { ion: "Cl⁻ 氯", g: 19.35, pct: 1.94 },
  { ion: "Na⁺ 钠", g: 10.78, pct: 1.08 },
  { ion: "SO₄²⁻ 硫酸根", g: 2.71, pct: 0.27 },
  { ion: "Mg²⁺ 镁", g: 1.28, pct: 0.13 },
  { ion: "Ca²⁺ 钙", g: 0.41, pct: 0.04 },
  { ion: "K⁺ 钾", g: 0.40, pct: 0.04 },
  { ion: "HCO₃⁻ 碳酸氢根", g: 0.126, pct: 0.01 },
  { ion: "Br⁻ 溴", g: 0.067, pct: 0.007 },
];

export const DEPTH_ZONES = [
  { id: "epi", name: "EPIPELAGIC", cn: "透光层", from: 0, to: 200, temp: "18–30 °C", light: "充足光合作用", life: "浮游植物、金枪鱼、珊瑚" },
  { id: "meso", name: "MESOPELAGIC", cn: "弱光层", from: 200, to: 1000, temp: "4–20 °C", light: "微弱蓝光", life: "灯笼鱼、皇带鱼、垂直迁徙者" },
  { id: "bathy", name: "BATHYPELAGIC", cn: "半深海层", from: 1000, to: 4000, temp: "2–4 °C", light: "无光", life: "鮟鱇、深海虾、抹香鲸觅食" },
  { id: "abysso", name: "ABYSSOPELAGIC", cn: "深海层", from: 4000, to: 6000, temp: "1–2 °C", light: "无光", life: "海参、海蛇尾、热泉群落" },
  { id: "hadal", name: "HADAL", cn: "超深渊层", from: 6000, to: 11000, temp: "1–4 °C", light: "无光", life: "狮子鱼、片脚类、嗜压微生物" },
];
