/**
 * 深度科普档案（v9 §10–§18）。
 *
 * 每个天体按同一套结构组织：概览 / 物理 / 内部 / 大气 / 表面 / 探测史 / 关键发现，
 * 外加任务时间线与来源清单。中文是正文（长文），英文给同段落的一句话摘要，
 * 保证 zh / en 两边都不为空。
 *
 * 事实来源以 NASA / JPL / USGS / ESA 的公开资料为准，写在 sources 里。
 */
export interface KnowledgeSection {
  id: string
  title: { zh: string; en: string }
  body: { zh: string; en: string }
}

export interface KnowledgeEvent {
  date: string
  text: { zh: string; en: string }
}

export interface KnowledgeArticle {
  id: string
  headline: { zh: string; en: string }
  lead: { zh: string; en: string }
  sections: KnowledgeSection[]
  timeline?: KnowledgeEvent[]
  sources: Array<{ title: string; url: string }>
}

const NASA = (path: string, title: string) => ({ title, url: `https://science.nasa.gov/${path}/` })

export const KNOWLEDGE: Record<string, KnowledgeArticle> = {
  earth: {
    id: 'earth',
    headline: { zh: '地球：目前已知唯一存在生命的世界', en: 'EARTH — the only known inhabited world' },
    lead: {
      zh: '地球是太阳系里第五大行星，也是唯一一颗表面同时存在液态水、板块运动与富氧大气的天体。它的磁场把恒星风挡在几十个地球半径之外，它的臭氧层把紫外线削到生命可承受的水平——这些条件不是巧合，而是四十六亿年演化留下的结果。',
      en: 'The largest rocky planet, and the only place where liquid water, plate tectonics and an oxygen-rich atmosphere coexist.',
    },
    sections: [
      {
        id: 'overview',
        title: { zh: '概览', en: 'OVERVIEW' },
        body: {
          zh: '地球的半径是 6,371 公里，质量 5.972×10²⁴ 公斤，平均密度 5.51 克每立方厘米——是太阳系里密度最大的行星。这个密度意味着它必须有一个以铁镍为主的金属核心，而不能只是岩石堆起来的球。地表 71% 被海洋覆盖，平均水深 3,688 米，总体水量约 13.86 亿立方公里。从太空看最显眼的特征不是大陆，而是那层厚度不到大气总量 1% 却决定性的水汽与云。地球的公转周期是 365.256 天，自转周期 23 小时 56 分 4 秒；自转轴相对轨道面倾斜 23.44°，这个倾角正是四季的成因。',
          en: 'Radius 6,371 km, mass 5.972×10²⁴ kg, mean density 5.51 g/cm³ — the densest planet. 71% ocean, 23.44° axial tilt gives the seasons.',
        },
      },
      {
        id: 'interior',
        title: { zh: '内部结构', en: 'INTERIOR' },
        body: {
          zh: '地震波把地球内部切开成四层：地壳厚 5–70 公里（大洋地壳薄、大陆地壳厚）；地幔厚约 2,890 公里，以固态硅酸盐为主，但因为极缓慢的对流而具备流动性，是板块运动的动力来源；外核厚约 2,260 公里，是液态的铁镍合金，它的对流与自转耦合形成地磁发电机；内核半径约 1,221 公里，压力高达约 360 万个大气压，铁在那种条件下是固态。地幔对流推动板块以每年几厘米的速度移动，于是有了山脉、海沟、火山与地震——太阳系里只有地球确认存在这种全球性板块构造。',
          en: 'Crust 5–70 km, mantle ~2,890 km, liquid outer core ~2,260 km, solid inner core ~1,221 km; the core dynamo drives the magnetic field, and mantle convection drives plate tectonics.',
        },
      },
      {
        id: 'atmosphere',
        title: { zh: '大气分层与成分', en: 'ATMOSPHERE' },
        body: {
          zh: '干空气的体积比是：氮 78.08%、氧 20.95%、氩 0.93%、二氧化碳 0.04%，其余为氖、氦、甲烷、氪等痕量气体。海平面气压 1,013.25 百帕，标高约 8.5 公里——也就是说每升高 8.5 公里气压就下降到约原来的 37%。自下而上分为五层：对流层（0–12 公里，全部天气现象都发生在这里，温度随高度下降）；平流层（12–50 公里，臭氧层集中在 20–30 公里，吸收紫外线使温度回升）；中间层（50–85 公里，流星在这里烧尽，是大气最冷处）；热层（85–600 公里，极光与空间站轨道所在，温度可达 1,500 K 但分子极稀）；散逸层（600 公里以上，逐渐过渡到行星际介质）。',
          en: 'N₂ 78.08%, O₂ 20.95%, Ar 0.93%, CO₂ 0.04%; pressure 1,013.25 hPa, scale height ~8.5 km; five layers from troposphere to exosphere.',
        },
      },
      {
        id: 'magnetosphere',
        title: { zh: '磁场与磁层', en: 'MAGNETOSPHERE' },
        body: {
          zh: '地表磁感应强度在 25–65 微特斯拉之间，赤道弱、两极强，近似一个偶极场，但磁轴与自转轴相差约 11°。太阳风把磁层的向阳面压缩到约 10 个地球半径处，背阳面则拉出一条长达数百万公里的磁尾。范艾伦辐射带里的高能电子与质子被磁场捕获，它们既是航天器的威胁，也是地球"有大气"的间接证据：没有磁层的行星（如火星）会在几十亿年里被太阳风剥掉大气。',
          en: '25–65 µT dipole tilted ~11°, magnetopause near 10 Earth radii, and Van Allen belts trapping energetic particles.',
        },
      },
      {
        id: 'hydrosphere',
        title: { zh: '水圈、生物圈与气候', en: 'HYDROSPHERE, BIOSPHERE, CLIMATE' },
        body: {
          zh: '地球处在一个"恰好"的距离上：内边缘之外（否则海洋会蒸发），外边缘之内（否则会长期冰封）。大气中的温室气体把地表平均温度从约 −18 ℃ 抬到 15 ℃，抬升 33 K——这就是温室效应的量级。地球接收的太阳常数是每平方米 1,361 瓦。光合作用在约 24 亿年前把大气从缺氧改造成富氧，这个事件（大氧化事件）改变了整个行星的化学史。今天大气中的游离氧几乎全部来自生物，所以"找氧气"成为寻找系外生命的一条主要线索。',
          en: 'Greenhouse warming adds ~33 K; oxygen is biological in origin, which is why O₂ is a biosignature in exoplanet searches.',
        },
      },
      {
        id: 'exploration',
        title: { zh: '观测与载人航天', en: 'OBSERVATION AND HUMAN SPACEFLIGHT' },
        body: {
          zh: '自 1957 年第一颗人造卫星起，近地轨道逐渐变成人类活动最密集的空间：目前在轨运行的人造物体数以万计，其中空间站（国际空间站与中国天宫）是长期驻人的平台。对地观测卫星用可见光、红外、雷达与微波测量海面高度、大气成分、植被与冰盖；气象卫星提供每 15 分钟一次的全圆盘图。可以说，人类第一次能够把地球当作一颗行星来整体测量，就是从这批卫星开始的。',
          en: 'Tens of thousands of tracked objects in orbit; Earth-observation and weather fleets turned the planet into a measurable system.',
        },
      },
    ],
    timeline: [
      { date: '1957-10-04', text: { zh: '斯普特尼克一号入轨，人类进入太空时代', en: 'Sputnik 1 opens the space age' } },
      { date: '1960-04-01', text: { zh: 'TIROS-1 拍下第一张气象卫星云图', en: 'TIROS-1 returns the first weather satellite image' } },
      { date: '1972-07-23', text: { zh: '陆地卫星一号开始系统观测地表', en: 'Landsat 1 begins systematic land observation' } },
      { date: '1990-11-14', text: { zh: 'ERS-1 用雷达高度计测量海面', en: 'ERS-1 measures sea surface with radar altimetry' } },
      { date: '1998-11-20', text: { zh: '国际空间站开始组装', en: 'ISS assembly begins' } },
      { date: '2016-12-11', text: { zh: '风云四号 A 星开始静止气象观测', en: 'Fengyun-4A begins geostationary weather watch' } },
      { date: '2021-04-29', text: { zh: '中国天宫空间站开始建造', en: 'Tiangong station construction starts' } },
    ],
    sources: [
      NASA('earth', 'NASA Science — Earth'),
      { title: 'NASA — Earth Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html' },
      { title: "NASA — Earth's Atmospheric Layers", url: 'https://www.nasa.gov/image-article/earths-atmospheric-layers-3/' },
    ],
  },

  moon: {
    id: 'moon',
    headline: { zh: '月球：被潮汐锁定四十六亿年的邻居', en: 'THE MOON — tidally locked for billions of years' },
    lead: {
      zh: '月球是地球唯一的天然卫星，半径 1,737.4 公里，大约是地球的 27%。它与地球的平均距离 384,400 公里，而且永远以同一面朝向地球——这不是巧合，而是潮汐锁定：月球的自转周期与公转周期同为 27.32 天。它的表面没有风、没有雨、没有大气，所以四十六亿年的撞击历史几乎完整地保存在那里。',
      en: 'Radius 1,737.4 km, mean distance 384,400 km, tidally locked: one rotation equals one orbit, 27.32 days.',
    },
    sections: [
      {
        id: 'overview',
        title: { zh: '概览', en: 'OVERVIEW' },
        body: {
          zh: '月球的平均密度只有 3.34 克每立方厘米，比地球低得多，说明它整体缺少大体积金属核——这是"大碰撞假说"的重要证据：约 45 亿年前，一颗火星大小的天体（常称为忒伊亚）撞上原始地球，溅出的碎片在轨道上重新聚成月球。月球的质量是地球的 1.23%，这个比例在卫星里异常高，因此地月常被看作一个双行星系统。由于没有大气散射，月球白天可达 127 ℃、夜间降到 −173 ℃，昼夜温差约 300 K。',
          en: 'Mean density 3.34 g/cm³ supports the giant-impact origin; without an atmosphere the surface swings from 127 °C to −173 °C.',
        },
      },
      {
        id: 'interior',
        title: { zh: '内部结构', en: 'INTERIOR' },
        body: {
          zh: '月球的地壳平均厚约 35–50 公里，背面比正面更厚；其下是约 1,300 公里的月幔；再往下是一个半径约 240 公里的部分熔融核，以铁为主，可能含少量硫。阿波罗任务留下的地震仪记录到"月震"，其中浅源月震与地球的潮汐应力有关。月球整体积累了明显的化学分层：正面以玄武岩海为主，背面以斜长岩高地为主，这种"两面性"至今仍在被解释。',
          en: 'Crust 35–50 km (thicker on the far side), mantle ~1,300 km, a partially molten core ~240 km across; shallow moonquakes are linked to tidal stress.',
        },
      },
      {
        id: 'surface',
        title: { zh: '月海、高地与撞击历史', en: 'MARIA, HIGHLANDS AND CRATERS' },
        body: {
          zh: '月球表面首先分成两类地貌：**月海**是约 31–39 亿年前的大型撞击盆地被玄武岩熔岩填平形成的暗色平原，例如雨海（直径 1,145 公里）、静海（873 公里，阿波罗 11 号着陆区）、澄海（707 公里）；**高地**是更古老的斜长岩地壳，年龄可达 44 亿年以上，颜色更亮、撞击坑更密。撞击坑按年代可以分层：第谷坑（直径 85 公里，约 1.08 亿年前）带有明显的辐射纹；哥白尼坑（93 公里）更年轻；南极-艾特肯盆地直径约 2,500 公里，是太阳系最大的撞击构造之一，也是嫦娥四号与嫦娥六号的工作区。表面覆盖着 5–15 米厚的月壤（regolith），由无数次撞击的碎屑胶结而成。极区永久阴影坑的雷达反射异常，被认为含有水冰——这也是未来长期驻留最有价值的资源之一。',
          en: 'Dark maria are 3.1–3.9 Gyr basaltic plains; bright highlands are ancient anorthosite. Regolith is 5–15 m thick; polar cold traps likely hold water ice.',
        },
      },
      {
        id: 'exosphere',
        title: { zh: '外逸层', en: 'EXOSPHERE' },
        body: {
          zh: '月球并非完全无大气，它有极稀薄的**外逸层**：近表面粒子密度约每立方厘米 10⁵ 个分子，成分包括氦、氖、氩、钠、钾与微量甲烷，主要来自太阳风注入、月壤的溅射与放射性衰变。NASA 的 LADEE 探测器在 2013–2014 年系统测量过这一层——它稀薄到不会产生任何天气，但足以影响尘埃行为。',
          en: 'A tenuous exosphere (~10⁵ molecules/cm³) of He, Ne, Ar, Na and K, fed by solar wind and regolith sputtering; measured by LADEE.',
        },
      },
      {
        id: 'exploration',
        title: { zh: '探测史', en: 'EXPLORATION' },
        body: {
          zh: '月球是唯一被人类踏足过的地外天体。竞争从 1959 年的月球 1–3 号开始；1969 年 7 月阿波罗 11 号完成首次载人着陆，此后阿波罗共带回 382 公斤样品。苏联用月球 16/20/24 号完成三次无人采样返回。进入 21 世纪，月球重新成为目标：中国的嫦娥一号至嫦娥六号完成了绕、落、回全流程，2024 年嫦娥六号首次从月背带回 1,935.3 克样品；印度的月船三号在 2023 年实现南极附近软着陆；NASA 的阿耳忒弥斯计划试图在 2020 年代把人送回月球并建立长期驻留。',
          en: 'Apollo returned 382 kg; Luna 16/20/24 and Chang』e 5/6 returned samples; Chang』e 6 brought back the first far-side material in 2024.',
        },
      },
    ],
    timeline: [
      { date: '1959-09-13', text: { zh: '月球 2 号成为第一个到达月面的探测器', en: 'Luna 2 becomes the first spacecraft to reach the Moon' } },
      { date: '1969-07-20', text: { zh: '阿波罗 11 号首次载人登月', en: 'Apollo 11 — first crewed landing' } },
      { date: '1970-09-24', text: { zh: '月球 16 号首次无人采样返回', en: 'Luna 16 — first robotic sample return' } },
      { date: '1972-12-19', text: { zh: '阿波罗 17 号结束载人登月阶段', en: 'Apollo 17 ends the crewed era' } },
      { date: '2019-01-03', text: { zh: '嫦娥四号首次在月背软着陆', en: 'Chang』e 4 — first far-side soft landing' } },
      { date: '2020-12-17', text: { zh: '嫦娥五号带回 1,731 克样品', en: 'Chang』e 5 returns 1,731 g' } },
      { date: '2024-06-25', text: { zh: '嫦娥六号从月背带回 1,935.3 克样品', en: 'Chang』e 6 returns 1,935.3 g from the far side' } },
    ],
    sources: [
      NASA('moon', 'NASA Science — Moon'),
      { title: 'NASA — Moon Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html' },
      { title: 'USGS Astrogeology — Lunar nomenclature', url: 'https://astrogeology.usgs.gov/search/map/Moon/Geology/lunar_nomenclature' },
    ],
  },

  mars: {
    id: 'mars',
    headline: { zh: '火星：被水和风重新雕刻过的世界', en: 'MARS — a world reshaped by water and wind' },
    lead: {
      zh: '火星比地球小一半左右，赤道半径 3,396.2 公里，平均密度 3.93 克每立方厘米。它今天的平均气压只有地球的 0.6%，主要成分是二氧化碳；但河床、三角洲、含水矿物与分层沉积岩同时表明，早期火星曾经长期存在液态水。理解"水去了哪里"，就是理解一颗行星如何失去宜居性。',
      en: 'Radius 3,396.2 km, surface pressure about 0.6% of Earth』s CO₂ atmosphere, yet ancient valleys and hydrated minerals show liquid water once flowed.',
    },
    sections: [
      {
        id: 'overview',
        title: { zh: '概览', en: 'OVERVIEW' },
        body: {
          zh: '火星的轨道半长轴 1.524 天文单位，公转周期 687 天，自转周期 24 小时 37 分，自转轴倾角 25.19°——和地球接近，因此也有四季，只是每个季节约两倍长。两极大地被干冰与水冰覆盖，冬季可扩展到纬度 50° 附近。火星有两颗很小的卫星：火卫一（平均半径约 11 公里）与火卫二（约 6 公里），一般认为是被捕获的小行星。',
          en: 'Semi-major axis 1.524 AU, year 687 days, sol 24 h 37 m, tilt 25.19°; the polar caps are dry ice plus water ice.',
        },
      },
      {
        id: 'interior',
        title: { zh: '内部结构与磁场', en: 'INTERIOR AND MAGNETISM' },
        body: {
          zh: '洞察号（InSight）在 2019–2022 年间用地震仪测出火星的地壳厚度在 24–72 公里之间，地幔约 1,560 公里，核心半径约 1,830 公里，且至少部分为液态。火星的全球磁场在约 40 亿年前就已消失，只在南半球地壳里留下大片的磁化条纹。今天它剩下的只有局部地壳磁场与一个很弱的感应磁层，这也是太阳风得以逐渐剥蚀其大气的主要原因。',
          en: 'Crust 24–72 km, mantle ~1,560 km, core radius ~1,830 km and partly liquid; the global dynamo died about 4 Gyr ago, leaving only crustal magnetism.',
        },
      },
      {
        id: 'atmosphere',
        title: { zh: '稀薄的大气与沙尘', en: 'THIN AIR AND DUST' },
        body: {
          zh: '火星大气体积比：二氧化碳 95.1%、氮 2.59%、氩 1.94%、氧 0.16%、一氧化碳 0.06%。地表平均气压约 6.1 毫巴，标高约 11 公里。虽然稀薄，却足以驱动全球性沙尘暴：局地尘暴可以发展成覆盖整颗行星数月的事件，把大气温度结构整体改变。极区二氧化碳随季节升华与凝结，使气压发生约 25% 的年变化。火星大气中的甲烷含量极低且信号反复，其来源（地质还是生物）至今没有定论。',
          en: 'CO₂ 95.1%, N₂ 2.59%, Ar 1.94%; ~6.1 mbar at the surface; global dust storms can last months.',
        },
      },
      {
        id: 'geology',
        title: { zh: '地貌：火山、峡谷与撞击盆地', en: 'GEOLOGY' },
        body: {
          zh: '塔尔西斯隆起是一个宽约 5,000 公里的火山高原，上面有奥林帕斯山——高 21.9 公里、基座宽约 600 公里，是太阳系最高的火山，比地球的冒纳凯阿（从海底算起约 10 公里）高一倍以上。赤道附近的水手号峡谷长 4,000 公里、最深处约 7 公里，被认为是地壳拉张与后续侵蚀共同作用的结果。南半球的希腊平原直径 2,300 公里、深约 7 公里，是巨大的撞击盆地。北部乌托邦平原是祝融号的着陆区，也是北半球最大的撞击盆地之一。耶泽罗坑与盖尔坑分别保存着古湖泊三角洲与 5 公里高的沉积山，是毅力号与好奇号的现场实验室。',
          en: 'Olympus Mons rises 21.9 km; Valles Marineris runs 4,000 km; Hellas spans 2,300 km; Jezero and Gale hold ancient lake deposits.',
        },
      },
      {
        id: 'exploration',
        title: { zh: '探测史', en: 'EXPLORATION' },
        body: {
          zh: '1965 年水手 4 号第一次近距离拍摄火星，终结了"运河"想象；1976 年维京 1/2 号完成首次成功着陆并做生物实验；1997 年探路者号带来第一辆火星车；2004 年勇气号与机遇号确认了液态水的直接证据（沉积岩与含水矿物）；2012 年好奇号用钻探分析确认盖尔坑曾是湖泊环境；2021 年毅力号在耶泽罗坑采集岩芯准备返回，同年中国的天问一号实现"绕、着、巡"一次完成，祝融号在乌托邦平原开始巡视。目前轨道上长期工作的还有火星勘测轨道器、火星奥德赛、Mars Express、ExoMars 微量气体轨道器与希望号。',
          en: 'Mariner 4 (1965), Viking (1976), Pathfinder (1997), Spirit/Opportunity (2004), Curiosity (2012), Perseverance and Tianwen-1/Zhurong (2021).',
        },
      },
    ],
    timeline: [
      { date: '1965-07-15', text: { zh: '水手 4 号首次飞掠并拍摄火星', en: 'Mariner 4 returns the first close-up images' } },
      { date: '1976-07-20', text: { zh: '维京 1 号成功着陆', en: 'Viking 1 lands successfully' } },
      { date: '2004-01-04', text: { zh: '勇气号着陆，随后确认古水环境', en: 'Spirit lands; water evidence follows' } },
      { date: '2012-08-06', text: { zh: '好奇号在盖尔坑着陆', en: 'Curiosity lands in Gale Crater' } },
      { date: '2021-02-18', text: { zh: '毅力号在耶泽罗坑着陆', en: 'Perseverance lands in Jezero Crater' } },
      { date: '2021-05-15', text: { zh: '祝融号着陆乌托邦平原', en: 'Zhurong lands in Utopia Planitia' } },
    ],
    sources: [
      NASA('mars', 'NASA Science — Mars'),
      { title: 'NASA — Mars Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html' },
      { title: 'NASA InSight — interior results', url: 'https://www.nasa.gov/mission/insight/' },
    ],
  },

  jupiter: {
    id: 'jupiter',
    headline: { zh: '木星：一颗几乎由氢构成的恒星候选者', en: 'JUPITER — a star that never ignited' },
    lead: {
      zh: '木星的质量是其余七颗行星总和的 2.5 倍，赤道半径 71,492 公里、是地球的 11.2 倍。它的成分以氢氦为主，结构与太阳相似，只是质量不足以点燃核聚变——如果再重 70 倍，它会成为一颗恒星。木星也是太阳系最强的"引力清扫机"：它的引力塑造了小行星带的空隙，也可能在早期改变了内太阳系的命运。',
      en: 'Mass 2.5× all other planets combined, radius 71,492 km, composition dominated by hydrogen and helium but far too light to fuse.',
    },
    sections: [
      {
        id: 'overview',
        title: { zh: '概览', en: 'OVERVIEW' },
        body: {
          zh: '木星的轨道半长轴 5.203 天文单位，公转周期 11.86 年，自转却是太阳系最快的：自转一周只要 9 小时 55 分，因此它是明显的扁球体——赤道半径比极半径长 4,600 多公里。平均密度 1.33 克每立方厘米，只有地球的四分之一。它已知的天然卫星数量在 95 颗以上，其中四颗伽利略卫星（木卫一、二、三、四）是 1610 年伽利略用望远镜发现的，它们的轨道本身就是"地球不是宇宙中心"的第一批硬证据。',
          en: 'Semi-major axis 5.203 AU, year 11.86 years, rotation 9 h 55 m (fastest), visibly oblate, 95+ known moons.',
        },
      },
      {
        id: 'interior',
        title: { zh: '内部结构', en: 'INTERIOR' },
        body: {
          zh: '从外向内：外层是分子氢与氦组成的大气；约 0.2–0.8 木星半径处氢被压成液态分子氢；再向内约 0.8–0.95 半径，压力超过百万大气压，氢变成导电的**金属氢**，它既是强磁场的发电机，也是木星内部热流的通道；中心可能是一个由岩石与冰混合的致密核心（也可能没有明确边界，属于"模糊核心"）。木星向太空辐射的能量是它接收太阳能的约 1.7 倍——说明它仍在缓慢收缩放热。',
          en: 'Molecular hydrogen → liquid hydrogen → metallic hydrogen (the dynamo region) → a diffuse dense core; it radiates ~1.7× the sunlight it receives.',
        },
      },
      {
        id: 'atmosphere',
        title: { zh: '大气、云带与风暴', en: 'ATMOSPHERE, BANDS AND STORMS' },
        body: {
          zh: '木星大气（体积比）约氢 89.8%、氦 10.2%，另有氨、硫化氢、甲烷与水。可见的"云带"是不同纬度上方向相反的急流：亮带（zones）是上升区，暗带（belts）是下沉区，风速可以超过每秒 100 米。最著名的结构是大红斑——一个反气旋风暴，长轴约 16,000 公里（比地球直径还大），至少已持续存在 190 年以上，但它正在缓慢缩小。朱诺号在 2016 年后发现了两项没有预料到的结构：极区由多个气旋围绕中心气旋组成稳定阵列；以及表面云带之下存在延伸到数千公里深度的"纬向流"，说明木星的带状风不只是表层现象。',
          en: 'H₂ 89.8%, He 10.2%, plus ammonia and water; jet streams reverse with latitude; the Great Red Spot is a centuries-old anticyclone now shrinking.',
        },
      },
      {
        id: 'magnetosphere',
        title: { zh: '磁层与辐射环境', en: 'MAGNETOSPHERE' },
        body: {
          zh: '木星磁场强度约为地球的 20,000 倍，是太阳系除太阳以外最强的行星星际磁场。它被太阳风压缩到向阳面约 60–70 个木星半径处，磁尾一直延伸到土星轨道附近。磁层中充满了来自木卫一的硫与氧离子，形成一圈巨大的等离子体环，并产生强度足以在几小时内使未受防护电子设备失效的辐射带——这也是设计木星探测器（如朱诺号）时最困难的约束之一。',
          en: 'A field ~20,000× Earth』s, a plasma torus fed by Io, and radiation belts severe enough to drive spacecraft shielding design.',
        },
      },
      {
        id: 'moons',
        title: { zh: '伽利略卫星与欧罗巴', en: 'GALILEAN MOONS AND EUROPA' },
        body: {
          zh: '木卫一（Io）是太阳系火山活动最剧烈的天体，因潮汐加热而不断喷发硫与二氧化硫；木卫二（Europa）表面是破碎的冰壳，其下很可能存在全球性液态水海洋，是寻找地外生命最重要的目标之一；木卫三（Ganymede）是太阳系最大的卫星，比水星还大，并且拥有自己的磁场；木卫四（Callisto）表面古老、辐射相对低，是研究早期太阳系的"化石"。ESA 的 JUICE（2023 年发射）与 NASA 的欧罗巴快船（2024 年发射）将进一步勘测这片系统。',
          en: 'Io is the most volcanically active body known; Europa likely hides a global ocean; Ganymede is larger than Mercury and has its own field; Callisto is ancient and less irradiated.',
        },
      },
    ],
    timeline: [
      { date: '1610-01-07', text: { zh: '伽利略发现木星四颗大卫星', en: 'Galileo discovers the four large moons' } },
      { date: '1973-12-04', text: { zh: '先驱者 10 号首次近距离飞掠', en: 'Pioneer 10 makes the first close flyby' } },
      { date: '1979-03-05', text: { zh: '旅行者 1 号发现木卫一火山与木星环', en: 'Voyager 1 reveals Io』s volcanoes and Jupiter』s ring' } },
      { date: '1995-12-07', text: { zh: '伽利略号进入木星轨道', en: 'Galileo enters orbit' } },
      { date: '2016-07-04', text: { zh: '朱诺号进入木星轨道', en: 'Juno enters orbit' } },
      { date: '2023-04-14', text: { zh: 'ESA 的 JUICE 发射', en: 'ESA launches JUICE' } },
      { date: '2024-10-14', text: { zh: 'NASA 欧罗巴快船发射', en: 'NASA launches Europa Clipper' } },
    ],
    sources: [
      NASA('jupiter', 'NASA Science — Jupiter'),
      { title: 'NASA — Jupiter Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html' },
      { title: 'NASA Juno mission', url: 'https://science.nasa.gov/mission/juno/' },
    ],
  },

  saturn: {
    id: 'saturn',
    headline: { zh: '土星：比水轻的行星与最精细的环系', en: 'SATURN — lighter than water, wrapped in rings' },
    lead: {
      zh: '土星的平均密度只有 0.687 克每立方厘米——比水还小，如果有足够大的水池它会上浮。它的赤道半径 60,268 公里，环系半径却延伸到约 136,800 公里。环的主要成分是水冰，最薄的细节可以细到几十米级；这套环系统同时是太阳系最漂亮的景观，也是研究行星形成盘的天然实验室。',
      en: 'Mean density 0.687 g/cm³ — less than water; the rings are almost pure water ice and reach ~136,800 km from the centre.',
    },
    sections: [
      {
        id: 'overview',
        title: { zh: '概览', en: 'OVERVIEW' },
        body: {
          zh: '土星的轨道半长轴 9.537 天文单位，公转周期 29.45 年；自转周期约 10 小时 33 分（用无线电周期测出）。自转轴倾角 26.73°，所以环的倾角随季节变化——这也是地球上观测者每 15 年左右能看到环"最开"与"近乎侧视"的原因。它是已知卫星最多的行星（146 颗以上），其中土卫六（泰坦）拥有浓密的大气，是太阳系除地球以外唯一有稳定液体（甲烷/乙烷湖）表面的天体。',
          en: 'Semi-major axis 9.537 AU, year 29.45 years, rotation ~10 h 33 m, tilt 26.73°, 146+ moons.',
        },
      },
      {
        id: 'interior',
        title: { zh: '内部结构', en: 'INTERIOR' },
        body: {
          zh: '土星内部与木星相似但不那么极端：外层氢氦大气，向内过渡到液态分子氢，再到金属氢层，最后是一个由岩石与冰组成的核心（质量可能达到地球的 9–22 倍）。因为密度更低、质量更小，金属氢层的范围比木星小。卡西尼号通过测量环的微小振动（环地震学）反推出土星内部存在稳定的分层结构，并发现它的自转周期比原先认为的稍长——这是最近十年对土星内部认知最重要的修正之一。',
          en: 'Hydrogen–helium envelope, liquid and then metallic hydrogen, and a rock-ice core; ring seismology re-measured the rotation period.',
        },
      },
      {
        id: 'rings',
        title: { zh: '环系结构', en: 'RING STRUCTURE' },
        body: {
          zh: '从内向外：D 环（很淡）、C 环、B 环（最亮最密，92,000–117,600 公里）、卡西尼缝（宽约 4,700 公里，因与土卫一的 2:1 共振而被清空）、A 环（122,200–136,800 公里，内部有恩克环缝与基勒环缝）、F 环（窄环，靠牧羊卫星维持），再外是 G 环与稀薄的 E 环（由土卫二喷出的水汽补给）。环的颗粒从沙粒到房屋大小不等，总质量约相当于土卫一的一半。它们非常薄——厚度往往只有 10–100 米。卡西尼号的最终结论是：环很年轻（可能只有约 1 亿年），并且在缓慢地落向土星——我们恰好生在一个能看到它的时代。',
          en: 'C, B, Cassini Division, A, F rings plus G and E; mostly water ice, tens of metres thick, probably only ~100 Myr old and slowly falling in.',
        },
      },
      {
        id: 'atmosphere',
        title: { zh: '大气与极区六边形', en: 'ATMOSPHERE AND THE HEXAGON' },
        body: {
          zh: '土星大气体积比约氢 96.3%、氦 3.25%，其余为甲烷、氨等。云顶温度约 −178 ℃。北极存在一个稳定的六边形急流：每条边约 14,500 公里，中心是一个窄而深的极地气旋——它至少已经存在几十年，成因与纬向风切变有关。土星还会周期性出现"大白斑"：大约每 30 年在某个纬度爆发一次大规模对流风暴，2010–2011 年的那次被卡西尼号完整记录。',
          en: 'H₂ 96.3%, He 3.25%, cloud-top ~−178 °C; a stable ~14,500 km-per-side hexagon surrounds the north polar cyclone.',
        },
      },
      {
        id: 'exploration',
        title: { zh: '探测史', en: 'EXPLORATION' },
        body: {
          zh: '1979 年先驱者 11 号首次飞掠；1980–81 年旅行者 1/2 号给出环与卫星的第一批细节；1997 年发射的卡西尼-惠更斯号在 2004 年进入土星轨道，之后 13 年里完成了 294 圈环绕，并让惠更斯探测器在 2005 年成功降落在土卫六表面——那是人类第一次在外太阳系着陆。卡西尼号还在土卫二南极发现了含盐的水汽喷流，直接指向地下海洋。2017 年 9 月 15 日，卡西尼号按计划冲入土星大气焚毁，以避免污染可能宜居的卫星。',
          en: 'Pioneer 11 (1979), Voyagers (1980–81), Cassini-Huygens (2004–2017) with the Huygens landing on Titan and the Enceladus plume discovery.',
        },
      },
    ],
    timeline: [
      { date: '1610-07-25', text: { zh: '伽利略首次看到环（当时以为是"耳朵"）', en: 'Galileo sees the rings but misreads them' } },
      { date: '1655-03-25', text: { zh: '惠更斯发现土卫六并解释环为盘', en: 'Huygens discovers Titan and identifies the rings as a disc' } },
      { date: '1979-09-01', text: { zh: '先驱者 11 号飞掠土星', en: 'Pioneer 11 flies past Saturn' } },
      { date: '2004-07-01', text: { zh: '卡西尼号进入土星轨道', en: 'Cassini enters Saturn orbit' } },
      { date: '2005-01-14', text: { zh: '惠更斯号着陆土卫六', en: 'Huygens lands on Titan' } },
      { date: '2005-11', text: { zh: '发现土卫二南极水汽喷流', en: 'Enceladus plume discovered' } },
      { date: '2017-09-15', text: { zh: '卡西尼号冲入土星大气结束任务', en: 'Cassini ends its mission in Saturn』s atmosphere' } },
    ],
    sources: [
      NASA('saturn', 'NASA Science — Saturn'),
      { title: 'NASA — Saturn Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html' },
      { title: 'NASA Cassini mission archive', url: 'https://science.nasa.gov/mission/cassini/' },
    ],
  },

  sun: {
    id: 'sun',
    headline: { zh: '太阳：太阳系 99.86% 的质量都在这里', en: 'THE SUN — 99.86% of the mass of the solar system' },
    lead: {
      zh: '太阳是一颗 G2V 型主序星，半径 696,000 公里、质量 1.989×10³⁰ 公斤。它每秒把约 6 亿吨氢聚变成氦，其中约 4 百万吨质量转化为能量——这正是地球上几乎所有能量的来源。它的核心温度约 1,500 万开尔文，而表面只有 5,772 开尔文，这种"内热外冷"的落差是理解恒星结构与太阳活动的基础。',
      en: 'A G2V star: radius 696,000 km, mass 1.989×10³⁰ kg, fusing ~600 Mt of hydrogen per second; core 15.7 MK, photosphere 5,772 K.',
    },
    sections: [
      {
        id: 'overview',
        title: { zh: '概览', en: 'OVERVIEW' },
        body: {
          zh: '太阳的年龄约 46 亿年，处于主序阶段的中点附近，还能稳定燃烧约 50 亿年；之后它会膨胀为红巨星，外层抛散成行星状星云，留下一个白矮星。太阳的化学成分按质量约氢 73%、氦 25%、其余 2%（氧、碳、铁、氖等）。它并非固态或液态，而是等离子体：带电粒子在磁场中运动，因此会有黑子、耀斑、日冕物质抛射等一整套"空间天气"现象。',
          en: 'About 4.6 Gyr old: hydrogen 73%, helium 25%, other elements 2% by mass; a plasma governed by magnetic fields.',
        },
      },
      {
        id: 'structure',
        title: { zh: '内部分层', en: 'INTERNAL LAYERS' },
        body: {
          zh: '从内到外：核心（半径约 0.25 太阳半径，1,570 万 K，聚变发生地）；辐射层（能量以光子形式扩散，光子从这里走到表面平均需要十几万年）；对流层（等离子体对流把能量带到表面，形成米粒组织）；光球层（我们看到的"日面"，约 5,500–6,000 K，厚约 500 公里）；色球层（厚约 2,000 公里，温度反常地升到 2 万 K 以上，日珥与耀斑在这里发生）；日冕（温度超过 100 万 K，可以延伸到数个太阳半径之外——"日冕加热问题"至今没有完全解决）。',
          en: 'Core → radiative zone → convection zone → photosphere → chromosphere → corona; the coronal heating problem remains open.',
        },
      },
      {
        id: 'activity',
        title: { zh: '太阳活动与 11 年周期', en: 'ACTIVITY AND THE 11-YEAR CYCLE' },
        body: {
          zh: '太阳活动强度呈现约 11 年的周期：黑子数从极小期到极大期变化可达一个数量级。黑子是光球层里磁场抑制对流的低温区，典型直径一万到十万公里，磁场强度可达 0.3 特斯拉（比地球磁场强上千倍）。当磁力线重组时，会释放耀斑（数分钟内释放最高 10²⁵ 焦耳）与日冕物质抛射（数十亿吨等离子体被抛出）。太阳风以每秒 400–800 公里的速度持续外流，遇到地球磁层时产生极光；强事件可以干扰卫星、导航与电网，这就是建立空间天气监测的原因。太阳还存在**差旋**：赤道约 25 天转一圈，极区约 35 天——这种"不同纬度不同转速"正是磁发电机维持的关键。',
          en: 'Sunspot cycle ~11 years; flares up to 10²⁵ J; CMEs of billions of tonnes; solar wind 400–800 km/s; differential rotation drives the dynamo.',
        },
      },
      {
        id: 'observation',
        title: { zh: '观测与探测', en: 'OBSERVATION' },
        body: {
          zh: '地面观测从伽利略时代的手绘黑子开始，现代则依靠多波段空间望远镜连续监测：SOHO（1995 年起）与 SDO（2010 年起）几乎不间断地拍摄极紫外与磁图。2018 年发射的帕克太阳探测器通过连续引力助推逐步逼近，2021 年首次"触碰"日冕；2020 年发射的太阳轨道器则提供了第一批评测太阳极区的影像。对太阳的研究同时也是行星科学的一部分：太阳风、磁层与行星大气的相互作用决定了哪些行星能保住自己的大气。',
          en: 'SOHO and SDO for continuous multi-wavelength monitoring; Parker Solar Probe entered the corona in 2021, Solar Orbiter images the poles.',
        },
      },
    ],
    timeline: [
      { date: '1610', text: { zh: '伽利略用望远镜记录黑子', en: 'Galileo records sunspots' } },
      { date: '1843', text: { zh: '施瓦贝发现黑子数的 11 年周期', en: 'Schwabe identifies the 11-year sunspot cycle' } },
      { date: '1995-12-02', text: { zh: 'SOHO 发射，开始不间断日地观测', en: 'SOHO launches' } },
      { date: '2010-02-11', text: { zh: '太阳动力学天文台（SDO）发射', en: 'SDO launches' } },
      { date: '2018-08-12', text: { zh: '帕克太阳探测器发射', en: 'Parker Solar Probe launches' } },
      { date: '2021-12-14', text: { zh: '帕克首次穿越日冕', en: 'Parker touches the corona' } },
    ],
    sources: [
      { title: 'NASA Science — Sun', url: 'https://science.nasa.gov/sun/' },
      { title: 'NASA — Sun Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html' },
      { title: 'NASA — Solar Dynamics Observatory', url: 'https://science.nasa.gov/mission/sdo/' },
    ],
  },

  mercury: {
    id: 'mercury',
    headline: { zh: '水星：被太阳烤着、却藏着冰', en: 'MERCURY — scorched by the Sun, yet holding ice' },
    lead: {
      zh: '水星是离太阳最近、也是最小的行星：半径 2,439.7 公里，只比月球大一点点。它没有真正的大气，表面昼夜温差是太阳系行星里最极端的（−173 ℃ 到 427 ℃）。它的一天比一年还长：自转 58.6 天，公转 88 天，也就是自转 3 圈正好公转 2 圈。',
      en: 'Radius 2,439.7 km; from −173 °C to 427 °C; rotation 58.6 days against an 88-day year — a 3:2 spin–orbit resonance.',
    },
    sections: [
      {
        id: 'interior',
        title: { zh: '内部：一个占比异常大的铁核', en: 'INTERIOR' },
        body: {
          zh: '水星的平均密度 5.43 克每立方厘米——和地球接近，但它的体积小得多、受到的压缩也小，这意味着它必须有一个**异常大的铁核**：半径约 2,020 公里，占整个行星半径的 85%。这个比例在太阳系里是独一无二的，通常解释为早期一次巨大撞击剥离了大部分硅酸盐地幔。信使号（MESSENGER）通过测量自转轴的微小摆动确认外核至少部分为液态，并发现了地壳收缩造成的数千公里长的逆冲断层（"皱脊"）。',
          en: 'Density 5.43 g/cm³ with a core filling ~85% of the radius — likely the result of a giant impact that stripped the mantle.',
        },
      },
      {
        id: 'surface',
        title: { zh: '表面：撞击盆地、皱脊与空穴', en: 'SURFACE' },
        body: {
          zh: '卡洛里盆地直径 1,550 公里，是水星最显著的地貌；它的对跖点还留着撞击震波聚焦形成的破裂地形。北极附近永久阴影的坑底在雷达上异常明亮，说明那里存在水冰——在离太阳最近的行星上找到冰，是行星科学里最反直觉的发现之一。水星还有太阳系里独有的"空穴地形"（hollows）：挥发性物质升华后留下的浅而不规则的凹坑。',
          en: 'Caloris basin is 1,550 km across; radar-bright polar craters hold water ice; hollows are unique volatile-loss pits.',
        },
      },
      {
        id: 'exploration',
        title: { zh: '探测史', en: 'EXPLORATION' },
        body: {
          zh: '水手 10 号在 1974–75 年三次飞掠，只拍到 45% 的表面；信使号在 2011–2015 年成为第一颗环绕水星的探测器，完成了全球测绘与磁场、重力场测量；欧日联合的 BepiColombo 于 2018 年发射，计划在多次引力助推后进入轨道。',
          en: 'Mariner 10 mapped 45% during flybys; MESSENGER orbited 2011–2015; BepiColombo is on its way.',
        },
      },
    ],
    timeline: [
      { date: '1974-03-29', text: { zh: '水手 10 号首次飞掠水星', en: 'Mariner 10 makes the first flyby' } },
      { date: '2011-03-18', text: { zh: '信使号进入水星轨道', en: 'MESSENGER enters orbit' } },
      { date: '2018-10-20', text: { zh: 'BepiColombo 发射', en: 'BepiColombo launches' } },
    ],
    sources: [
      NASA('mercury', 'NASA Science — Mercury'),
      { title: 'NASA — Mercury Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/mercuryfact.html' },
    ],
  },

  venus: {
    id: 'venus',
    headline: { zh: '金星：温室效应失控的教科书', en: 'VENUS — runaway greenhouse in the flesh' },
    lead: {
      zh: '金星的半径 6,051.8 公里，只比地球小 5%，常被称作地球的"孪生兄弟"。但它的地表温度约 464 ℃、气压是地球的 92 倍，大气 96.5% 是二氧化碳，还飘着硫酸云——同一颗太阳下，两颗几乎一样大的行星走向了两个极端。它也是太阳系里唯一逆向自转的行星：自转周期 243 天，比它 225 天的公转还长。',
      en: 'Radius 6,051.8 km, 464 °C, 92 bar, CO₂ 96.5% with sulfuric acid clouds, retrograde rotation of 243 days.',
    },
    sections: [
      {
        id: 'atmosphere',
        title: { zh: '大气与温室效应', en: 'ATMOSPHERE' },
        body: {
          zh: '金星大气质量是地球的约 93 倍。二氧化碳制造了极端的温室效应，把地表温度抬到足以熔化铅的水平；而云层中的硫酸液滴在 45–70 公里高度形成一个完全遮蔽可见光的"云顶"，这就是为什么早期的可见光观测看不到它的表面。更奇怪的是"超旋"：云顶每 4 天就绕金星一圈，而金星本体的自转要 243 天——大气与固体几乎是脱耦的。2010 年代之后还发现高层大气中的磷化氢、二氧化硫异常等未解信号，成因仍有争议。',
          en: 'A 93× Earth atmosphere; CO₂ greenhouse drives 464 °C; the cloud deck super-rotates in four days while the solid body takes 243.',
        },
      },
      {
        id: 'surface',
        title: { zh: '表面：高原、火山与陨石坑', en: 'SURFACE' },
        body: {
          zh: '麦哲伦号的雷达测绘揭示了金星的表面：约 80% 是火山平原，其余是以伊什塔尔高地、阿佛洛狄忒高地为主的高原；麦克斯韦山脉最高约 10.7 公里。表面约有 900 个撞击坑，而且几乎没有小于 3 公里的坑——这说明小陨石在稠密大气中就被烧毁或减速了。撞击坑的分布显示金星表面整体很年轻（平均约 3–6 亿年），暗示曾经有过一次全球性的火山重塑。',
          en: '80% volcanic plains, highlands like Ishtar and Aphrodite, and ~900 impact craters with a young average surface age.',
        },
      },
      {
        id: 'exploration',
        title: { zh: '探测史', en: 'EXPLORATION' },
        body: {
          zh: '苏联的金星系列（Venera）在 1960–80 年代完成了第一次进入大气、第一次软着陆与第一批地表照片，最长的一台在 464 ℃ 下工作了约 127 分钟；麦哲伦号在 1990–94 年用雷达绘制了 98% 的表面；ESA 的 Venus Express 与日本的拂晓号分别研究了大气动力学。未来十年将有 NASA 的 DAVINCI 与 VERITAS、ESA 的 EnVision 三次任务集中重返金星。',
          en: 'Venera landers pioneered surface imaging; Magellan radar-mapped 98%; DAVINCI, VERITAS and EnVision will return in the 2030s.',
        },
      },
    ],
    timeline: [
      { date: '1962-12-14', text: { zh: '水手 2 号首次成功飞掠金星', en: 'Mariner 2 makes the first successful flyby' } },
      { date: '1970-08-17', text: { zh: '金星 7 号首次软着陆并回传数据', en: 'Venera 7 makes the first soft landing' } },
      { date: '1982-03-01', text: { zh: '金星 13 号传回第一批地表彩色照片', en: 'Venera 13 returns the first colour surface images' } },
      { date: '1990-08-10', text: { zh: '麦哲伦号开始雷达测绘', en: 'Magellan begins radar mapping' } },
    ],
    sources: [
      NASA('venus', 'NASA Science — Venus'),
      { title: 'NASA — Venus Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html' },
    ],
  },

  uranus: {
    id: 'uranus',
    headline: { zh: '天王星：侧躺着的冰巨星', en: 'URANUS — the ice giant on its side' },
    lead: {
      zh: '天王星的赤道半径 25,559 公里，是太阳系第三大行星。它的自转轴相对轨道面倾斜 97.8°——几乎"躺着"绕太阳滚动，因此两极会经历各约 42 年的极昼与极夜。它是第一颗用望远镜发现的行星（1781 年威廉·赫歇尔），也是唯一只被旅行者 2 号访问过一次的巨行星。',
      en: 'Radius 25,559 km, axial tilt 97.8° giving 42-year polar days, discovered in 1781 and visited only once, by Voyager 2.',
    },
    sections: [
      {
        id: 'atmosphere',
        title: { zh: '大气与甲烷', en: 'ATMOSPHERE' },
        body: {
          zh: '天王星大气体积比约氢 83%、氦 15%、甲烷 2.3%。甲烷吸收红光，使它在可见光下呈现出青蓝色；与木星土星不同，它的云带极其平淡——旅行者 2 号只看到少数几个亮斑。它的有效温度约 −216 ℃，是太阳系行星里最低的，部分原因是内部热流异常微弱（它向外的辐射几乎与接收的太阳能相当），这一点与海王星形成鲜明对照。',
          en: 'H₂ 83%, He 15%, CH₄ 2.3%; methane gives the cyan colour, and the internal heat flow is remarkably weak.',
        },
      },
      {
        id: 'interior',
        title: { zh: '内部与磁场', en: 'INTERIOR AND MAGNETISM' },
        body: {
          zh: '天王星被归类为"冰巨星"：在氢氦大气与岩石核心之间，是一层由水、氨和甲烷组成的高压"冰"（其实是热而稠密的导电流体）。它最反常的特征是磁场：磁轴与自转轴相差约 59°，而且不通过行星中心——磁场像被甩到一侧的陀螺。极光观测（哈勃与地面望远镜）显示磁层与自转轴错位造成的复杂结构。它的 13 条环很窄、颜色偏暗，主要由深色物质构成。',
          en: 'An icy mantle between envelope and core; the magnetic axis is tilted 59° and offset from the centre; 13 narrow dark rings.',
        },
      },
      {
        id: 'moons',
        title: { zh: '卫星系统', en: 'MOONS' },
        body: {
          zh: '天王星有 28 颗已知卫星，命名全部取自莎士比亚与蒲柏的作品——这是威廉·赫歇尔之子约翰·赫歇尔定下的惯例。天卫五（米兰达）表面有高达 20 公里的悬崖（Verona Rupes），是太阳系已知最高的断崖之一；天卫一（阿里尔）与天卫三（泰坦尼亚）表面显示出明显的冰火山或构造活动的痕迹。',
          en: '28 moons named after Shakespeare and Pope; Miranda has cliffs up to 20 km high, and Ariel shows signs of geological activity.',
        },
      },
    ],
    timeline: [
      { date: '1781-03-13', text: { zh: '威廉·赫歇尔发现天王星', en: 'William Herschel discovers Uranus' } },
      { date: '1977-03-10', text: { zh: '发现天王星环系', en: 'The ring system is discovered' } },
      { date: '1986-01-24', text: { zh: '旅行者 2 号飞掠天王星', en: 'Voyager 2 flies past Uranus' } },
    ],
    sources: [
      NASA('uranus', 'NASA Science — Uranus'),
      { title: 'NASA — Uranus Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/uranusfact.html' },
    ],
  },

  neptune: {
    id: 'neptune',
    headline: { zh: '海王星：风速两千公里的冰巨星', en: 'NEPTUNE — ice giant with 2,100 km/h winds' },
    lead: {
      zh: '海王星是离太阳最远的行星，赤道半径 24,764 公里。它的风速最高可达每小时 2,100 公里，是太阳系已知最快的行星风——尽管它接收的阳光只有地球的千分之一。它是通过数学预测而被发现的行星：1846 年勒维耶与亚当斯根据天王星轨道摄动算出它的位置，柏林天文台当晚就找到了它。',
      en: 'Radius 24,764 km; winds up to 2,100 km/h — the fastest known — and discovered in 1846 by prediction rather than chance.',
    },
    sections: [
      {
        id: 'atmosphere',
        title: { zh: '大气与风暴', en: 'ATMOSPHERE AND STORMS' },
        body: {
          zh: '海王星大气体积比约氢 80%、氦 19%、甲烷 1.5%，云顶温度约 −214 ℃。1989 年旅行者 2 号看到过一个地球大小的"大暗斑"，但 1994 年哈勃观测时它已经消失——这类暗斑更像短寿命的涡旋，而不是木星大红斑那样的长期结构。它辐射出的能量是吸收太阳能的约 2.6 倍，说明内部有额外热源，也解释了为什么"离太阳更远却更喧闹"。',
          en: 'H₂ 80%, He 19%, CH₄ 1.5%; dark spots are transient vortices, and it radiates 2.6× the energy it receives.',
        },
      },
      {
        id: 'moons',
        title: { zh: '海卫一与环弧', en: 'TRITON AND RING ARCS' },
        body: {
          zh: '海卫一（Triton）是太阳系唯一大型**逆行**卫星，直径 2,707 公里，很可能是一颗被捕获的柯伊伯带天体。它的表面温度 −235 ℃，却仍有氮气间歇泉喷发，表面年龄很轻。海王星的环包含五条主要细环，其中几条有明显的"亮弧"——这些弧由与海卫一的轨道共振维持，是行星环动力学里非常特殊的案例。',
          en: 'Triton is the only large retrograde moon, likely a captured Kuiper Belt object, with nitrogen geysers; bright ring arcs are shepherded by resonances.',
        },
      },
    ],
    timeline: [
      { date: '1846-09-23', text: { zh: '柏林天文台发现海王星', en: 'Neptune is found from a predicted position' } },
      { date: '1989-08-25', text: { zh: '旅行者 2 号飞掠海王星', en: 'Voyager 2 flies past Neptune' } },
    ],
    sources: [
      NASA('neptune', 'NASA Science — Neptune'),
      { title: 'NASA — Neptune Fact Sheet (NSSDC)', url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptunefact.html' },
    ],
  },

  pluto: {
    id: 'pluto',
    headline: { zh: '冥王星：被重新分类，也重新被发现', en: 'PLUTO — reclassified, and rediscovered' },
    lead: {
      zh: '冥王星平均半径 1,188 公里，比月球还小。1930 年被发现后它一直是"第九大行星"，直到 1992 年以后柯伊伯带天体被大量发现，2006 年国际天文学联合会把它重新定义为矮行星。2015 年新视野号飞掠时，人类第一次看清了它——一个有着氮冰冰川、水冰山与多层雾霭的复杂世界。',
      en: 'Mean radius 1,188 km; reclassified as a dwarf planet in 2006; New Horizons revealed nitrogen glaciers and water-ice mountains in 2015.',
    },
    sections: [
      {
        id: 'surface',
        title: { zh: '表面：斯普特尼克平原与汤博区', en: 'SURFACE' },
        body: {
          zh: '冥王星最显眼的地貌是"心形"的汤博区，其左叶斯普特尼克平原是一片巨大的氮冰冰川，表面几乎没有撞击坑——说明它仍在被对流缓慢重塑，年龄可能不到一千万年。边缘耸立着赖特山与丹增山，高 3–5 公里的水冰山，与喜马拉雅山脉同量级；由于那里的水冰在 −230 ℃ 下硬如岩石，这些山才没有被压塌。它的大气极稀薄，气压只有地球的十万分之一，但包含多层由甲烷光解产物构成的雾霭。',
          en: 'Sputnik Planitia is a convecting nitrogen glacier with almost no craters; 3–5 km water-ice mountains line its edge; haze layers rise 200 km.',
        },
      },
      {
        id: 'system',
        title: { zh: '双矮行星系统', en: 'A DOUBLE DWARF SYSTEM' },
        body: {
          zh: '冥王星与冥卫一（Charon）互相潮汐锁定，围绕共同质心旋转——质心位于两颗天体之外，所以它们更像一对双星，而不是"行星+卫星"。冥卫一直径 1,212 公里，接近冥王星的一半，另有三颗小卫星（尼克斯、许德拉、刻耳柏洛斯）在更外层。',
          en: 'Pluto and Charon are mutually tidally locked around a barycentre outside Pluto; three smaller moons orbit beyond.',
        },
      },
    ],
    timeline: [
      { date: '1930-02-18', text: { zh: '汤博发现冥王星', en: 'Clyde Tombaugh discovers Pluto' } },
      { date: '2006-08-24', text: { zh: 'IAU 重新定义为矮行星', en: 'IAU reclassifies it as a dwarf planet' } },
      { date: '2015-07-14', text: { zh: '新视野号飞掠冥王星', en: 'New Horizons flies past Pluto' } },
    ],
    sources: [
      NASA('dwarf-planets/pluto', 'NASA Science — Pluto'),
      { title: 'NASA New Horizons mission', url: 'https://science.nasa.gov/mission/new-horizons/' },
    ],
  },
}
