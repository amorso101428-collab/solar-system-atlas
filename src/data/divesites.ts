export interface DiveSite {
  id: string; name_en: string; name_cn: string; country: string;
  ocean: string; lon: number; lat: number;
  tempC: string; visibility: string; depth: string; season: string;
  baseFlow: "CALM" | "SLIGHT" | "MODERATE" | "STRONG" | "VERY STRONG";
  waterType: string; access: string;
  life: string[]; gear: string[]; watch: string[];
  note: string; source: string;
}

/**
 * Reference dive regions. Temperatures / visibility are typical ranges, not
 * guarantees, and must be re-verified against the cited operators before
 * publication. The *live* current and flow level come from the CurrentField.
 */
export const DIVE_SITES: DiveSite[] = [
  { id: "gbr-cod-hole", name_en: "COD HOLE · RIBBON REEFS", name_cn: "大堡礁 鳕鱼洞", country: "AUSTRALIA", ocean: "pacific", lon: 145.75, lat: -14.66,
    tempC: "24–29 °C", visibility: "15–40 m", depth: "5–30 m", season: "JUN–OCT (旱季)",
    baseFlow: "MODERATE", waterType: "珊瑚礁 · 外礁", access: "船宿 / 日潜船",
    life: ["巨型苏眉", "礁鲨", "海龟", "珊瑚"], gear: ["3 mm 湿衣", "礁钩", "SMB"],
    watch: ["放流潜水", "船流密集", "季风期海况"], note: "大堡礁北段外礁，受东澳大利亚洋流影响，能见度随季节波动。", source: "GBRMPA / 运营商资料" },
  { id: "palau-blue-corner", name_en: "BLUE CORNER", name_cn: "帕劳 蓝角", country: "PALAU", ocean: "pacific", lon: 134.22, lat: 7.27,
    tempC: "28–30 °C", visibility: "20–40 m", depth: "15–30 m", season: "NOV–MAY",
    baseFlow: "STRONG", waterType: "礁壁 · 洋流汇聚", access: "日潜船",
    life: ["灰礁鲨", "苏眉", "鹰鳐", "梭鱼群"], gear: ["3 mm", "礁钩", "手套"],
    watch: ["强下降流", "必须挂礁钩", "出口水流"], note: "世界最著名放流潜点之一，洋流把浮游生物推上礁壁，聚合大型掠食者。", source: "Palau Visitors Authority" },
  { id: "galapagos-darwin", name_en: "DARWIN & WOLF", name_cn: "加拉帕戈斯 达尔文/沃尔夫", country: "ECUADOR", ocean: "pacific", lon: -91.82, lat: 1.68,
    tempC: "18–26 °C", visibility: "10–25 m", depth: "10–30 m", season: "JUN–NOV",
    baseFlow: "VERY STRONG", waterType: "洋流岛屿 · 温跃层", access: "船宿",
    life: ["锤头鲨群", "鲸鲨", "加拉帕戈斯鲨", "海鬣蜥"], gear: ["5–7 mm", "头套", "证件齐全"],
    watch: ["强流与温跃层", "冷水层", "仅船宿可达"], note: "秘鲁寒流带来的冷水与温跃层造就全球最壮观的锤头鲨群。", source: "Galápagos National Park" },
  { id: "cocos", name_en: "COCOS ISLAND", name_cn: "科科斯岛", country: "COSTA RICA", ocean: "pacific", lon: -87.06, lat: 5.53,
    tempC: "24–28 °C", visibility: "15–30 m", depth: "15–35 m", season: "JUN–DEC",
    baseFlow: "STRONG", waterType: "外海岛屿 · 上升流", access: "仅船宿（36h 航程）",
    life: ["锤头鲨群", "白鳍鲨", "蝠鲼", "海豚"], gear: ["5 mm", "备流钩", "干袋"],
    watch: ["离岸 550 km", "无医疗后送", "强流"], note: "东太平洋最著名的远洋鲨群潜点，海况与流况对经验要求高。", source: "Costa Rica 保护区管理" },
  { id: "maldives-maaya-thila", name_en: "MAAYA THILA", name_cn: "马尔代夫 玛雅提拉", country: "MALDIVES", ocean: "indian", lon: 72.88, lat: 4.08,
    tempC: "27–30 °C", visibility: "20–40 m", depth: "8–30 m", season: "DEC–APR（东北季风）",
    baseFlow: "MODERATE", waterType: "海山礁 · 通道流", access: "日潜船 / 船宿",
    life: ["灰礁鲨", "蝠鲼", "拿破仑鱼", "海龟"], gear: ["3 mm", "SMB", "流钩"],
    watch: ["通道进出流", "季风转换期", "船只交通"], note: "阿里环礁代表潜点，东北季风期水流与能见度最佳。", source: "Maldives 潜水运营商" },
  { id: "red-sea-ras-mohammed", name_en: "RAS MOHAMMED", name_cn: "红海 穆罕默德角", country: "EGYPT", ocean: "indian", lon: 34.26, lat: 27.72,
    tempC: "22–29 °C", visibility: "20–45 m", depth: "5–40 m", season: "MAR–NOV",
    baseFlow: "MODERATE", waterType: "珊瑚礁壁 · 断裂带", access: "日潜船",
    life: ["远洋白鳍鲨", "珊瑚", "海豚", "拿破仑鱼"], gear: ["5 mm", "SMB"],
    watch: ["漂流出口", "船流", "冬季水温骤降"], note: "红海北部经典礁壁，能见度常年极佳。", source: "Egyptian Environmental Affairs" },
  { id: "sipadan", name_en: "SIPADAN", name_cn: "西巴丹", country: "MALAYSIA", ocean: "pacific", lon: 118.63, lat: 4.11,
    tempC: "27–30 °C", visibility: "20–40 m", depth: "5–40 m", season: "APR–OCT",
    baseFlow: "MODERATE", waterType: "大洋岛屿 · 断崖", access: "日潜（每日限额）",
    life: ["梭鱼风暴", "绿海龟", "礁鲨", "杰克鱼群"], gear: ["3 mm", "SMB"],
    watch: ["每日名额限制", "断崖外流", "潜店配额"], note: "因洋流汇聚形成著名梭鱼风暴与海龟聚集。", source: "Sabah Parks" },
  { id: "similan", name_en: "SIMILAN ISLANDS", name_cn: "斯米兰群岛", country: "THAILAND", ocean: "indian", lon: 97.63, lat: 8.65,
    tempC: "27–30 °C", visibility: "15–35 m", depth: "5–35 m", season: "NOV–APR（季风期闭岛）",
    baseFlow: "MODERATE", waterType: "花岗岩礁 · 沙底", access: "船宿 / 日潜船",
    life: ["豹纹鲨", "蝠鲼", "珊瑚", "海龟"], gear: ["3 mm", "SMB"],
    watch: ["5–10 月闭岛", "西南季风", "浪大"], note: "安达曼海典型季风控制潜点，开放期完全由季风决定。", source: "Thai DNP" },
  { id: "cayman-bloody-bay", name_en: "BLOODY BAY WALL", name_cn: "开曼 血腥湾墙", country: "CAYMAN ISLANDS", ocean: "atlantic", lon: -81.41, lat: 19.68,
    tempC: "26–29 °C", visibility: "25–45 m", depth: "5–40 m", season: "NOV–MAY",
    baseFlow: "SLIGHT", waterType: "断崖壁潜", access: "日潜船",
    life: ["鹰鳐", "礁鲨", "海龟", "海绵"], gear: ["3 mm", "电筒"],
    watch: ["深壁需控制深度", "船流", "飓风季"], note: "加勒比最著名的断崖墙潜，通常流况温和。", source: "Cayman Islands DoE" },
  { id: "tubbataha", name_en: "TUBBATAHA REEFS", name_cn: "图巴塔哈群礁", country: "PHILIPPINES", ocean: "pacific", lon: 119.92, lat: 8.85,
    tempC: "27–30 °C", visibility: "20–45 m", depth: "5–40 m", season: "MAR–JUN",
    baseFlow: "STRONG", waterType: "环礁 · 苏禄海通道", access: "仅船宿",
    life: ["礁鲨", "蝠鲼", "珊瑚", "金枪鱼"], gear: ["3 mm", "流钩", "SMB"],
    watch: ["仅船宿且窗口短", "强流", "无锚泊"], note: "苏禄海中央的环礁，季节窗口极短但生物量惊人。", source: "Tubbataha Management Office" },
  { id: "raja-ampat", name_en: "RAJA AMPAT", name_cn: "四王群岛", country: "INDONESIA", ocean: "pacific", lon: 130.45, lat: -0.62,
    tempC: "27–30 °C", visibility: "15–35 m", depth: "5–30 m", season: "OCT–APR",
    baseFlow: "MODERATE", waterType: "珊瑚三角区 · 海峡", access: "船宿 / 度假村",
    life: ["须鲨", "蝠鲼", "极高珊瑚多样性", "豆丁海马"], gear: ["3 mm", "SMB"],
    watch: ["海峡可强流", "偏远医疗", "潮汐窗口"], note: "全球海洋生物多样性中心，潮汐驱动的海峡流是主要变量。", source: "Raja Ampat MPA" },
  { id: "monterey-kelp", name_en: "MONTEREY KELP FOREST", name_cn: "蒙特雷 巨藻林", country: "USA", ocean: "pacific", lon: -121.90, lat: 36.62,
    tempC: "12–17 °C", visibility: "5–20 m", depth: "5–25 m", season: "AUG–NOV",
    baseFlow: "MODERATE", waterType: "巨藻林 · 上升流", access: "岸潜 / 日潜船",
    life: ["海獭", "海狮", "巨藻", "石斑"], gear: ["7 mm 湿衣或干衣", "电筒", "浮力袋"],
    watch: ["上升流期能见度骤降", "冷水", "涌浪与涌流"], note: "加利福尼亚寒流驱动的上升流系统，冷水与营养盐塑造巨藻林。", source: "NOAA MBNMS" },
  { id: "silfra", name_en: "SILFRA RIFT", name_cn: "冰岛 银湖裂谷", country: "ICELAND", ocean: "atlantic", lon: -21.02, lat: 64.26,
    tempC: "2–4 °C（全年）", visibility: "80–100 m", depth: "12–18 m", season: "全年（需冰潜经验）",
    baseFlow: "SLIGHT", waterType: "裂谷 · 冰川融水", access: "岸潜（导潜强制）",
    life: ["北极红点鲑", "藻类", "极少生物量"], gear: ["干式潜水衣", "暖衣", "手套头套"],
    watch: ["接近冰点水温", "干衣训练", "通道狭窄处"], note: "两大板块裂谷，冰川融水能见度极高但几乎无生物。", source: "Þingvellir National Park" },
  { id: "aliwal-shoal", name_en: "ALIWAL SHOAL", name_cn: "南非 阿利瓦尔浅滩", country: "SOUTH AFRICA", ocean: "indian", lon: 30.28, lat: -30.28,
    tempC: "19–25 °C", visibility: "8–25 m", depth: "12–30 m", season: "MAY–SEP（沙丁鱼 6–7 月）",
    baseFlow: "STRONG", waterType: "外海浅滩 · 洋流", access: "日潜船",
    life: ["沙虎鲨", "远洋白鳍鲨", "沙丁鱼大迁徙", "海龟"], gear: ["5 mm", "SMB", "流钩"],
    watch: ["厄加勒斯洋流强流", "涌浪", "沙丁鱼季船只多"], note: "受厄加勒斯洋流影响，6–7 月可见全球最大的沙丁鱼迁徙。", source: "SAEON / Ezemvelo KZN" },
];

export function findDiveSite(id: string) { return DIVE_SITES.find((s) => s.id === id) ?? null; }

export function nearestDiveSite(lon: number, lat: number, maxDeg = 5): DiveSite | null {
  let best: DiveSite | null = null, bd = maxDeg;
  for (const s of DIVE_SITES) {
    const d = Math.hypot(lon - s.lon, lat - s.lat);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
