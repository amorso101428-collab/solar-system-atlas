import type { LocalizedText } from './types'

/**
 * 天体档案的补充事实表（v5 §19）。
 *
 * 行星主表（planets.ts）只保留几何与运行学数据；这里补上质量、重力、成分、
 * 大气、发现与探测情况，让详情页从"一行字"变成一份能读下去的档案。
 * 数值取自 NASA Planetary Fact Sheet 与 IAU 公布值。
 */
export interface BodyFacts {
  massKg?: number
  /** 表面重力 m/s² */
  gravity?: number
  /** 平均表面温度 °C */
  meanTempC?: number
  composition?: LocalizedText
  atmosphere?: LocalizedText
  discovery?: LocalizedText
  exploration?: LocalizedText
  /** 公转周期（地球日） */
  orbitDays?: number
  /** 额外条目：任意补充读数 */
  extra?: Array<{ label: LocalizedText; value: string }>
}

const zh = (zhText: string, en: string): LocalizedText => ({ zh: zhText, en })

export const BODY_FACTS: Record<string, BodyFacts> = {
  sun: {
    massKg: 1.989e30,
    gravity: 274,
    meanTempC: 5505,
    composition: zh('氢 73.5%、氦 24.9%、氧 / 碳 / 铁等 1.6%', 'H 73.5%, He 24.9%, O/C/Fe 1.6%'),
    discovery: zh('自文明之初即被观测', 'Observed since prehistory'),
    exploration: zh(
      '帕克太阳探测器 2021 年首次穿越日冕；SDO 持续 24 小时监测日面与磁场。',
      'Parker Solar Probe first entered the corona in 2021; SDO monitors the solar surface around the clock.'
    ),
  },
  mercury: {
    massKg: 3.301e23,
    gravity: 3.7,
    meanTempC: 167,
    composition: zh('铁质巨核（约占体积 55%）+ 硅酸盐地幔', 'Iron core (~55% of volume) + silicate mantle'),
    atmosphere: zh('几乎没有大气，只有极稀薄的逃逸层', 'Essentially no atmosphere, only an exosphere'),
    discovery: zh('古代已知', 'Known since antiquity'),
    exploration: zh('水手 10 号（1974）、信使号（2011–2015）、贝皮科伦坡（2025 起入轨）', 'Mariner 10 (1974), MESSENGER (2011–2015), BepiColombo (arriving 2025)'),
    orbitDays: 87.97,
  },
  venus: {
    massKg: 4.867e24,
    gravity: 8.87,
    meanTempC: 464,
    composition: zh('铁核 + 硅酸盐地幔 + 玄武岩地壳', 'Iron core + silicate mantle + basaltic crust'),
    atmosphere: zh('96.5% 二氧化碳、3.5% 氮，气压为地球 92 倍', '96.5% CO₂, 3.5% N₂, 92× Earth pressure'),
    discovery: zh('古代已知，常被称为启明星', 'Known since antiquity'),
    exploration: zh('金星 7 号首次软着陆（1970）、麦哲伦号雷达测绘、金星快车、拂晓号', 'Venera 7 first soft landing (1970), Magellan radar mapping, Venus Express, Akatsuki'),
    orbitDays: 224.7,
  },
  earth: {
    massKg: 5.972e24,
    gravity: 9.81,
    meanTempC: 15,
    composition: zh('铁镍核 + 硅酸盐地幔 + 岩石地壳 + 液态水海洋', 'Fe-Ni core + silicate mantle + rocky crust + liquid water'),
    atmosphere: zh('78% 氮、21% 氧，含臭氧层', '78% N₂, 21% O₂, with an ozone layer'),
    discovery: zh('—', '—'),
    exploration: zh('人类唯一的家园；在轨可跟踪目标超过一万个', 'Our only home; more than ten thousand trackable objects in orbit'),
    orbitDays: 365.26,
  },
  mars: {
    massKg: 6.417e23,
    gravity: 3.71,
    meanTempC: -63,
    composition: zh('铁硫核 + 硅酸盐地幔 + 富氧化铁地壳', 'Fe-S core + silicate mantle + iron-oxide crust'),
    atmosphere: zh('95% 二氧化碳，气压不足地球 1%', '95% CO₂, less than 1% of Earth pressure'),
    discovery: zh('古代已知', 'Known since antiquity'),
    exploration: zh('海盗号、探路者、勇气 / 机遇号、好奇号、毅力号与祝融号', 'Viking, Pathfinder, Spirit/Opportunity, Curiosity, Perseverance, Zhurong'),
    orbitDays: 686.98,
  },
  jupiter: {
    massKg: 1.898e27,
    gravity: 24.79,
    meanTempC: -108,
    composition: zh('氢氦为主，可能有稀释的岩石核心；无固体表面', 'Mostly H/He with a diluted rocky core; no solid surface'),
    atmosphere: zh('氨与氢硫化铵云带，风速可达 500 km/h', 'Ammonia and ammonium-hydrosulfide cloud bands, winds to 500 km/h'),
    discovery: zh('古代已知；1610 年伽利略发现四颗大卫星', 'Known since antiquity; Galileo found the four large moons in 1610'),
    exploration: zh('先驱者 / 旅行者飞掠、伽利略号（1995–2003）、朱诺号（2016– ）、JUICE 与欧罗巴快船在途', 'Pioneer/Voyager flybys, Galileo (1995–2003), Juno (2016–), JUICE and Europa Clipper en route'),
    orbitDays: 4332.59,
    extra: [{ label: zh('大红斑', 'Great Red Spot'), value: '≈ 1.3 × 地球直径，持续至少 190 年' }],
  },
  saturn: {
    massKg: 5.683e26,
    gravity: 10.44,
    meanTempC: -139,
    composition: zh('氢氦为主，密度小于水', 'Mostly H/He, mean density below water'),
    atmosphere: zh('氨冰云顶，赤道风速 1800 km/h', 'Ammonia-ice cloud tops, equatorial winds 1800 km/h'),
    discovery: zh('古代已知；1655 年惠更斯发现土卫六', 'Known since antiquity; Huygens found Titan in 1655'),
    exploration: zh('先驱者 11 号、旅行者 1/2 号、卡西尼–惠更斯（2004–2017）', 'Pioneer 11, Voyager 1/2, Cassini–Huygens (2004–2017)'),
    orbitDays: 10759.22,
    extra: [
      { label: zh('环系', 'Ring system'), value: 'D/C/B/A/F 环，主环厚度仅约 10–100 m' },
      { label: zh('卡西尼缝', 'Cassini Division'), value: 'B 环与 A 环之间，宽约 4,800 km' },
    ],
  },
  uranus: {
    massKg: 8.681e25,
    gravity: 8.69,
    meanTempC: -197,
    composition: zh('冰巨星：水、氨、甲烷的"热冰"幔', 'Ice giant: hot ices of water, ammonia and methane'),
    atmosphere: zh('氢氦 + 甲烷（呈青绿色）', 'H/He with methane (giving the cyan tint)'),
    discovery: zh('1781 年由威廉·赫歇尔发现', 'Discovered by William Herschel in 1781'),
    exploration: zh('只有旅行者 2 号在 1986 年造访过一次', 'Only Voyager 2 has visited, in 1986'),
    orbitDays: 30685.4,
    extra: [{ label: zh('自转轴倾角', 'Axial tilt'), value: '97.8°（几乎躺着自转）' }],
  },
  neptune: {
    massKg: 1.024e26,
    gravity: 11.15,
    meanTempC: -201,
    composition: zh('冰巨星，成分与天王星相近但更致密', 'Ice giant, similar composition to Uranus but denser'),
    atmosphere: zh('氢氦 + 甲烷，风速可达 2100 km/h', 'H/He with methane, winds to 2100 km/h'),
    discovery: zh('1846 年由勒维耶预测、伽勒观测确认', 'Predicted by Le Verrier, observed by Galle in 1846'),
    exploration: zh('仅旅行者 2 号在 1989 年飞掠', 'Only Voyager 2, during its 1989 flyby'),
    orbitDays: 60189,
  },
  pluto: {
    massKg: 1.303e22,
    gravity: 0.62,
    meanTempC: -229,
    composition: zh('岩石核 + 水冰幔 + 氮 / 甲烷 / 一氧化碳冰表面', 'Rocky core + water-ice mantle + N₂/CH₄/CO ices'),
    atmosphere: zh('极稀薄的氮气，近日点时会升华', 'Extremely thin nitrogen, sublimating near perihelion'),
    discovery: zh('1930 年由汤博发现', 'Discovered by Clyde Tombaugh in 1930'),
    exploration: zh('新视野号 2015 年飞掠', 'New Horizons flyby in 2015'),
    orbitDays: 90560,
    extra: [{ label: zh('与冥卫一', 'With Charon'), value: '互相潮汐锁定，质心位于两者之间' }],
  },
}

/** 主要天然卫星的补充档案 */
export const MOON_FACTS: Record<string, BodyFacts> = {
  moon: {
    massKg: 7.342e22,
    gravity: 1.62,
    composition: zh('硅酸盐岩石，几乎没有水冰；铁核很小', 'Silicate rock, almost no water ice, small iron core'),
    discovery: zh('—', '—'),
    exploration: zh('阿波罗 6 次载人登月（1969–1972）、嫦娥系列、月船 3 号', 'Six crewed Apollo landings (1969–1972), Chang’e, Chandrayaan-3'),
    orbitDays: 27.32,
  },
  io: {
    massKg: 8.932e22,
    gravity: 1.796,
    composition: zh('硅酸盐岩石 + 熔融铁核，表面覆盖硫与二氧化硫霜', 'Silicate rock with a molten iron core; sulfur & SO₂ frost'),
    discovery: zh('1610 年伽利略发现', 'Discovered by Galileo in 1610'),
    exploration: zh('旅行者 1/2 号、伽利略号、新视野号、朱诺号', 'Voyager 1/2, Galileo, New Horizons, Juno'),
    orbitDays: 1.77,
    extra: [{ label: zh('火山', 'Volcanism'), value: '400 多座活火山，喷发高度可达 500 km' }],
  },
  europa: {
    massKg: 4.800e22,
    gravity: 1.315,
    composition: zh('岩质核 + 约 100 km 厚的水冰壳与液态海洋', 'Rocky core + ~100 km water-ice shell over a liquid ocean'),
    discovery: zh('1610 年伽利略发现', 'Discovered by Galileo in 1610'),
    exploration: zh('伽利略号重点考察；欧罗巴快船 2030 年抵达', 'Studied by Galileo; Europa Clipper arrives in 2030'),
    orbitDays: 3.55,
  },
  ganymede: {
    massKg: 1.4819e23,
    gravity: 1.428,
    composition: zh('冰壳 + 岩石幔 + 液态铁核（有全球磁场）', 'Ice shell, rocky mantle, liquid iron core — it has its own field'),
    discovery: zh('1610 年伽利略发现', 'Discovered by Galileo in 1610'),
    exploration: zh('伽利略号、朱诺号、JUICE（2031 年入轨）', 'Galileo, Juno, JUICE (arriving 2031)'),
    orbitDays: 7.15,
  },
  callisto: {
    massKg: 1.0759e23,
    gravity: 1.235,
    composition: zh('几乎未分化的冰岩混合体', 'A nearly undifferentiated ice–rock mixture'),
    discovery: zh('1610 年伽利略发现', 'Discovered by Galileo in 1610'),
    exploration: zh('伽利略号、朱诺号', 'Galileo, Juno'),
    orbitDays: 16.69,
  },
  titan: {
    massKg: 1.3452e23,
    gravity: 1.352,
    composition: zh('水冰与岩石，表面有液态甲烷湖泊', 'Water ice and rock, with liquid-methane lakes'),
    atmosphere: zh('1.45 bar 氮气为主，橙色有机雾霾', '1.45 bar nitrogen with orange organic haze'),
    discovery: zh('1655 年惠更斯发现', 'Discovered by Christiaan Huygens in 1655'),
    exploration: zh('卡西尼–惠更斯（2005 年着陆）、蜻蜓号旋翼机计划 2034 年抵达', 'Cassini–Huygens (landed 2005); Dragonfly arrives ~2034'),
    orbitDays: 15.95,
  },
  enceladus: {
    massKg: 1.08e20,
    gravity: 0.113,
    composition: zh('几乎纯水冰，南极有地下海洋', 'Almost pure water ice with a subsurface ocean at the south pole'),
    discovery: zh('1789 年赫歇尔发现', 'Discovered by William Herschel in 1789'),
    exploration: zh('卡西尼号多次穿越羽流取样', 'Cassini repeatedly flew through its plumes'),
    orbitDays: 1.37,
  },
  triton: {
    massKg: 2.14e22,
    gravity: 0.779,
    composition: zh('氮冰 / 水冰表面，逆行轨道', 'Nitrogen and water ices, retrograde orbit'),
    discovery: zh('1846 年拉塞尔发现', 'Discovered by William Lassell in 1846'),
    exploration: zh('仅旅行者 2 号在 1989 年飞掠', 'Only Voyager 2, in 1989'),
    orbitDays: 5.88,
  },
  charon: {
    massKg: 1.586e21,
    gravity: 0.288,
    composition: zh('水冰为主，北极有红色托林覆盖', 'Mostly water ice with reddish tholins at the north pole'),
    discovery: zh('1978 年克里斯蒂发现', 'Discovered by James Christy in 1978'),
    exploration: zh('新视野号 2015 年飞掠', 'New Horizons flyby in 2015'),
    orbitDays: 6.39,
  },
}
