import type { KnowledgeSection } from './knowledge'

type Reading = { sections: KnowledgeSection[]; sources: Array<{title:string;url:string}> }
const chapter=(id:string,zhTitle:string,enTitle:string,zh:string,en:string):KnowledgeSection=>({id,title:{zh:zhTitle,en:enTitle},body:{zh,en}})

/** Observation guides connect the image to the science; they are not live telemetry. */
export const OBSERVATION_READING:Record<string,Reading>={
  earth:{
    sections:[
      chapter('reading-earth-light','从晨昏线读懂光照','READING THE TERMINATOR',
        '在“向阳面”视角，日照覆盖可见圆面的大部分区域，适合比较大陆、海洋和云系；转到“晨昏线”，球面的曲率与受光方向变得直观。明暗交界不是地表上的固定线，而是随着地球自转与观察位置变化的几何关系。\n\n大气会使过渡带比无大气天体更柔和，但不会把整个背光半球照亮。细薄的蓝色边缘来自大气散射与较长的斜向光程，和厚实的蓝色外壳是两回事。界面中的三个按钮只改变观察方向，不会把太阳灯光移到镜头旁；这样从不同角度看到的仍是同一套昼夜关系。',
        'The day-side view reveals continents and clouds; the terminator view shows the lighting geometry. The boundary is not a fixed geographic line. Atmospheric scattering softens twilight without illuminating the entire night side. View presets move the observer while preserving the scene’s light source.'),
      chapter('reading-earth-clouds','云、海洋与一张地球照片','CLOUDS, OCEANS AND PHOTOGRAPHS',
        '真实太空照片里的海洋往往是深蓝至灰蓝，厚云比海水明亮得多，薄云又能透出下方的地表。海面在合适的太阳—海洋—观察者夹角下会出现局部反光；它不应像涂了清漆一样到处发亮。不同相机的曝光、光谱响应和照片处理也会改变这些颜色，因此不能只用“蓝得够不够亮”判断真实性。\n\n本站把地表与云层分开显示，以便在球缘和晨昏线上呈现层次。全球贴图来自不同时刻的合成资料，云层运动用于视觉演示，不代表此刻天气，也不能还原用户提供照片的拍摄时刻。地理标注依附于地表经纬度，不随云图的漂移改变位置。',
        'Clouds are usually much brighter than oceans; thin cloud can reveal the terrain below. Ocean glint is localized by viewing geometry. Exposure and processing affect photographic colour. This atlas uses separate surface and cloud layers built from historical composites, not live weather. Geographic labels remain attached to the ground.'),
      chapter('reading-earth-systems','把地球作为相互作用的系统','AN INTERCONNECTED EARTH',
        '地球的宜居性来自长期相互作用。海洋储存并输送热量，大气通过辐射和环流重新分配能量；岩石风化、火山活动与生物过程参与碳的循环。讨论气候时，既要看太阳输入，也要看反射率、温室气体以及海洋吸收的变化。某一天的一团云不能单独说明长期气候趋势。\n\n观测卫星因此不会只拍一张彩色照片：不同仪器分别测量海温、云与气溶胶、冰盖高度、重力变化、植被和地表形变。要把这些结果放在一起理解，还需要明确测量时间、空间分辨率和不确定性。图谱中的任务档案可以作为认识这些观测方式的入口。',
        'Oceans, atmosphere, rocks and life exchange energy and matter. Weather in a single image is not a climate trend. Earth-observing missions combine measurements of temperature, clouds, ice, gravity, vegetation and deformation, each with its own time coverage, resolution and uncertainty.')
    ],
    sources:[{title:'NASA — Earth facts',url:'https://science.nasa.gov/earth/facts/'},{title:'ESA — ERS at a glance',url:'https://www.esa.int/Applications/Observing_the_Earth/ERS_at_a_glance'}]
  },
  sun:{
    sections:[
      chapter('reading-sun-spectrum','为什么照片中的太阳颜色不同','WHY SOLAR IMAGES LOOK DIFFERENT',
        '白光观测主要展示光球层，可见黑子及米粒组织；窄带观测则从太阳光谱中选取特定谱线，用来强调其他高度或状态的物质。Hα 观测突出色球层中的结构，摄影作品常再用橙金色着色，让暗条、亮斑与临边细节容易辨认。极紫外图像也常用指定颜色表达波段，它们并不等于肉眼会看到的太阳颜色。\n\n本站的“色球层”模式以这类窄带摄影为视觉方向，纹理是艺术重建；“白光”模式提供另一种表面观感。两者用于解释观测方式的差异，不能当作某一天太阳活动的实测图，也不能据此测量黑子位置或活动强度。',
        'White-light observations mainly show the photosphere. Narrow spectral bands emphasize other solar structures; H-alpha imagery highlights chromospheric features and is often colourized. The atlas’s chromosphere texture is an artistic reconstruction, not a dated observation or a map for measuring solar activity.'),
      chapter('reading-sun-prominence','日珥、暗条、耀斑不是同一种现象','PROMINENCES, FILAMENTS AND FLARES',
        '日珥是受磁场约束的等离子体结构。从太阳边缘看，它可以成为突出轮廓的亮弧；投影在更明亮的日面上时，类似结构会表现为暗条。它们不是从固体表面喷出的火焰，形态和演化与磁场密切相关。\n\n耀斑指突然增强的电磁辐射，日冕物质抛射则涉及向外抛出的等离子体和磁场；两者可以相关，但不能互相替代。本站的弧形动画用来帮助辨认日珥的空间形状，不会预报耀斑，也没有把动画速度换算成真实喷发速度。观察时可以先比较临边弧线与日面暗条，再切换白光模式理解不同波段显示的信息。',
        'Prominences are magnetically supported plasma, seen as bright structures off the limb or dark filaments against the disk. Flares are bursts of electromagnetic radiation; coronal mass ejections expel plasma and magnetic field. They can be associated but are distinct phenomena. The animation is illustrative, not a forecast.'),
      chapter('reading-sun-energy','从核心聚变到行星空间','FROM FUSION TO INTERPLANETARY SPACE',
        '太阳能量主要在核心通过氢聚变产生，随后穿过内部的辐射区与对流区，再从大气向外传播。光球并不是坚硬的地面，而是太阳大气中我们在可见光下看到的主要发光层。向外进入日冕时，温度反而升高，因此“离核心越远一定越冷”不能解释整颗太阳。\n\n光、太阳风和活动事件携带不同形式的能量，传播方式与到达时间也不同。研究者需要把遥感影像、磁场测量及探测器直接采样结合起来。一个明亮的图像区域只能说明特定观测条件下的辐射特征，不能单凭颜色推断它的全部物理状态。',
        'Fusion energy travels through radiative and convective regions before escaping. The visible photosphere is not solid ground, and the outer corona is hotter than it. Light, solar wind and eruptive events transport energy differently; interpreting them requires both remote observations and in-situ measurements.')
    ],
    sources:[{title:'NASA — Sun facts',url:'https://science.nasa.gov/sun/facts/'},{title:'NASA — Solar vocabulary',url:'https://science.nasa.gov/heliophysics/resources/vocabulary/'},{title:'NASA — Parker enters the solar atmosphere',url:'https://www.nasa.gov/solar-system/nasa-enters-the-solar-atmosphere-for-the-first-time-bringing-new-discoveries/'}]
  },
  moon:{
    sections:[
      chapter('reading-moon-phases','月相与“月球背面”','PHASES AND THE FAR SIDE',
        '月球始终有大约一半表面受太阳照亮；从地球看到的受光部分随日、地、月的相对位置而变化，形成月相。月相通常不是地球影子造成的，只有月食才涉及月球进入地球阴影。\n\n月球的自转与绕地公转同步，使它大致以同一面朝向地球。因此“背面”表示长期背向地球的一侧，而不是永远没有阳光的一侧。查看地貌时，晨昏线附近的低角度光照更容易突出地形；本图谱使用球面贴图表现主要地貌，不能把贴图明暗当成精确的地形高度。',
        'Phases arise from viewing different portions of the Moon’s sunlit hemisphere, not normally from Earth’s shadow. Synchronous rotation produces a near side and a far side; both experience daylight. The atlas’s surface map is not a terrain elevation model.'),
      chapter('reading-moon-evidence','如何读出月球的过去','READING THE LUNAR RECORD',
        '月海的暗色主要来自玄武岩，与周围较亮的古老高地构成对照。撞击坑的重叠关系可以帮助判断事件先后，但要得到绝对年龄，还需要样品定年和经过校准的撞击统计；不能简单认定“更亮就更新”。\n\n月球缺少地球式风雨侵蚀，却不断受到微陨石撞击、太阳风及冷热循环的改造。永久阴影区的低温又提供了保存挥发物的环境。这些地点的资源潜力、分布和可利用性是不同问题，探测到水冰不等于已经发现可直接开采的水库。',
        'Basaltic maria contrast with brighter ancient highlands. Crater superposition gives relative ages; absolute chronology also needs dated samples and calibrated counts. Micrometeoroids and thermal cycling alter the regolith. Detecting polar ice does not by itself establish an accessible resource deposit.')
    ],
    sources:[{title:'NASA — Moon facts',url:'https://science.nasa.gov/moon/facts/'},{title:'NASA — Moonquakes',url:'https://science.nasa.gov/moon/moonquakes/'}]
  },
  mercury:{
    sections:[chapter('reading-mercury-day','“一天比一年长”指哪一种天？','TWO MEANINGS OF A DAY',
      '水星相对恒星自转一圈约需 58.6 个地球日，绕太阳一圈约需 88 个地球日。因此若把“一天”定义成自转周期，它并不比一年长。常见说法指的是**太阳日**：从一次正午到下一次正午，约需 176 个地球日。\n\n两者之所以不同，是因为水星一边自转，一边在轨道上移动；其 3∶2 自转—公转共振使太阳在天空中的运动格外特殊。本图谱中的自转展示经过时间缩放，读真实周期时应以参数和这一解释为准，而不是用动画转一圈所需的秒数推算。',
      'Mercury rotates relative to the stars in about 58.6 Earth days and orbits in about 88. A solar day, from noon to noon, lasts about 176 Earth days. “A day longer than a year” refers to the solar day. The atlas accelerates rotation for viewing.')],
    sources:[{title:'NASA — Mercury’s solar day',url:'https://science.nasa.gov/photojournal/ill-be-back/'}]
  },
  neptune:{
    sections:[chapter('reading-neptune-images','风暴照片不是永久地理地图','STORMS ARE NOT FIXED LANDMARKS',
      '海王星影像中的暗斑、亮云与细带是大气中的现象，可以移动、改变形状甚至消失。它们与岩石天体上的撞击坑不同：给一团风暴永久绑定一个经纬度，会把拍摄时刻的信息误写成固定地貌。\n\n旅行者 2 号、哈勃和韦布使用的仪器与波段不同，影像对比度和颜色也不能直接互比。这个图谱使用固定贴图建立可辨认的外观，不能把其中某个斑点理解为此时此刻仍在那里。环弧则属于环粒子的分布结构，需要与大气风暴分开理解。',
      'Dark spots and bright clouds are evolving atmospheric features, not permanent terrain. Images from different instruments and wavelengths are not directly interchangeable. This atlas uses a fixed appearance map, not current weather. Ring arcs are particle concentrations distinct from atmospheric storms.')],
    sources:[{title:'NASA — Neptune facts',url:'https://science.nasa.gov/neptune/neptune-facts/'}]
  },
  pluto:{
    sections:[chapter('reading-pluto-map','一次飞掠怎样形成一张全球图','WHAT A FLYBY MAP CAN SHOW',
      '新视野号飞掠让冥王星从模糊光点变成有冰原、山地和薄雾的世界。但飞掠不是长期绕行：不同区域获得的分辨率、光照和覆盖范围并不相同。因此一张包裹整个球体的纹理，不意味着各处都曾被同样清晰地拍摄。\n\n观察斯普特尼克平原等地貌时，应区分有高分辨率影像支持的区域和较粗略的全球背景。图谱中的地标需与贴图投影和经度约定一致；遇到模糊区域时，不应靠生成细节伪装成新的科学观测。冥王星的矮行星分类改变的是分类定义，并没有降低它的地质复杂性。',
      'New Horizons obtained uneven resolution and lighting during its flyby. A globe texture does not imply equally detailed observations everywhere. Labels must follow the map projection and longitude convention, and invented detail must not be presented as observed terrain.')],
    sources:[{title:'NASA — Pluto facts',url:'https://science.nasa.gov/dwarf-planets/pluto/facts/'},{title:'NASA — Pluto’s moons',url:'https://science.nasa.gov/dwarf-planets/pluto/moons/facts/'}]
  }
}
