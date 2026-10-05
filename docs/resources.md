# 资源来源与实现范围 · 2026-10-02

## 2026-10-03 · 潜水与丹麦音乐彩蛋

新增用户提供的完整本地音频：Grand Blue — 湘南乃風、What A Life — Scarlet Pleasure。来源、触发与音乐开关规则见 [音乐彩蛋说明](music-easter-eggs.md)，与原背景专辑许可记录分开记录。

## 10 月版地理标注、云层与音乐更新

首页中英文版号更新为 2026 年 10 月 / EDITION 2026.10；历史天文历元和天气有效时间没有改成版号。

七大洲、五大洋在全球视角显示，靠近地球逐级显示国家／地区、城市、街区、道路、地标及地理地貌。标注跟随地球投影，隐藏背面名称，并避开导航、面板和相邻文字；地理标注默认开启，可从「图层」单独关闭，随全站语言切换。

258 个国家／地区与 7,342 个城市的名称及位置来自 [Natural Earth 国家数据](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries.geojson)和[城市数据](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_populated_places.geojson)，为 [public domain](https://www.naturalearthdata.com/about/terms-of-use/)。中文通过 OpenCC 在构建数据时统一为简体；该转换器不进入浏览器包。数据分成国家、主要城市、全部城市三份，按视野层级延迟加载。`scripts/build-place-labels.mjs` 可重新生成，也可传入两份已下载的 GeoJSON 离线生成。

街道及地标按需读取 [CARTO Streets TileJSON](https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json)，使用实际返回的 `name:zh` / `name:en` 属性。地图数据 © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)，ODbL，底图服务 © [CARTO](https://carto.com/attributions)，界面保留署名。近景镜头停稳 350ms 后加载，最多九个瓦片、三个并发请求，保留 36 个解析后缓存，请求 10 秒超时；失败保留本地城市标注，显示细节暂不可用并延迟重试。没有下载完整世界街道数据库，也不保证每个地名都有译名；缺少中文译名时保留原名；英文模式仅显示已有英文或拉丁字母名称的条目，避免中英混杂。重要地标优先于次要道路与商业兴趣点。

摄影云壳从此前约 10–13 km 提高至统一 45 km 的**视觉展示高度**，不是气象测量高度；靠近时平滑消隐，进入云壳下方不留下遮挡地表的白膜。自然摄影云层仍不是实时云观测。

音乐每次新打开或刷新默认为开启，保留手动关闭。宇宙与探索地球内部切换会一次性传递当次开关选择，避免刚关闭又在跳转后响起；该选择不会成为下次访问的静音偏好。浏览器限制有声自动播放时，在第一次点击后开始播放。

**最新引擎变更：** 海洋端已改为 Cesium 分级卫星影像与真实高程地形；太阳系着色器仍用于太阳系，4K 地表仅用于离线 / 加载失败的全球后备图。Google Earth 式导航、提供方许可与 Google 三维配置说明以 [地理地球说明](geospatial-earth.md) 为准。下文「共用地球模型」描述前一版 Three.js 实现。

## 用户提供的太阳系项目

来源：`/Users/quincy./Documents/ChatGPT/洋流网页/solar-system-atlas`。整合副本位于 `integrations/solar-system-atlas`，保留原作者界面、来源、贴图和说明；新增海洋入口、镜头推进、跨页面转场与返回。构建输出两套独立 React/Three 包和轨道 worker，不依赖原文稿目录。

## 共用地球模型

`src/shared/planetShaders.ts` 提取太阳系的噪声、地表与顶点 / 片元着色器；仅把太阳位置显式参数化，两端共用同一地表模型。海洋端拆分海陆掩膜、叠加可控分析色彩，独立绘制云层和大气，最终进行一次 ACES / sRGB 输出。日照方向靠近初始非洲视角，曝光 1.35。

海洋端的 `public/earth/solar-earth_daymap-4k.jpg`、`solar-earth_clouds-4k.jpg`、`solar-earth_nightmap-2k.jpg` 与太阳系对应文件逐字节一致，测试核对 SHA-256。源项目 `src/data/images.generated.ts` 和原下载脚本将地球影像署名为 **Solar System Scope · CC BY 4.0**；[官方纹理页面](https://www.solarsystemscope.com/textures/)说明此纹理包使用 NASA 等影像，按 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)分发。4K 文件沿用用户项目版本，没有重新下载或改写图像；渲染中的颜色、照明、分层是代码处理。署名与来源链接也在陆地、海洋和云层的图层说明内。

原 Blender 版本的地表资源保留；当前自然地球使用太阳系版本。海陆掩膜、分析用水深纹理沿用项目原资源，未改动 `Downloads/地球.blend`。海岸线将 Natural Earth 110m 地形数据转换为球面线段（现由 Cesium 贴地绘制）；星空为程序生成的 3600 个交互粒子，非科学星表。未使用图像亮度作为几何高程。

[Esri World Imagery](https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer) 按完整可见视野加载分级影像；保留提供方署名，不批量下载或离线再分发。实际 DEM 改为 [Mapzen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)，格式与各源许可见 [官方说明](https://github.com/tilezen/joerd/tree/master/docs)。当前浏览器实测山地高程与 CORS 读取正常。极区超出 DEM 覆盖使用参考椭球，保存冰盖纹理覆盖影像边缘。

## 全球天气网格

官方源：NOAA/NCEP GFS，通过 [NSF Unidata THREDDS](https://tds.scigw.unidata.ucar.edu/thredds/catalog/grib/NCEP/GFS/Global_0p25deg/catalog.html) NCSS 获取。原生 0.25°，请求 stride 1，输出 1440×721 网格，经度 −180°至179.75°、纬度 −90°至90°，较此前 2° 的空间采样细 8 倍。

变量：10 m 的 u/v 风分量（m/s）、地表降水率（kg m⁻² s⁻¹，乘 3600 转 mm/h）、整层总云量（百分比转覆盖率）。经纬度排序、去重复接缝，按每个变量 CF 时间记录有效时间；缺失或非法值中止更新。

本次保存版本有效时间：**2026-10-02 03:00 UTC**。`public/weather/gfs-surface.json` 记录实际请求 URL、有效时间、下载时间、分辨率及单位，风雨 `.bin` 和云量 `.bin` 均为 Float32；`gfs-surface-source.nc` 保留官方原始子集。风、雨、云量属于预报产品，非实时观测或雷达。

`scripts/environment-feed.mjs` 在本地 Node 预览及 Vite 中提供自动刷新；每小时检查官方源，保留最近三版，失败 10 分钟后重试。浏览器每分钟检查、恢复前台时检查；新版本无需重新构建。当前保存版本保证无服务时可读。纯静态文件托管不具备后台刷新能力。`scripts/fetch-weather.mjs` 可手动更新并保留原始 NetCDF，Python 入口兼容转调 Node。

摄影云层使用原 Solar System Scope CC BY 4.0 保存合成纹理，暗背景完全透明，亮度只控制云透明度，不作为地表高程。此前把 GFS 覆盖率与摄影纹理相乘并增加 20% 底膜，导致灰斑；本次完全移除该合成。GFS 云量作为独立百分比色彩图层，开启时隐藏摄影云层，关闭后恢复用户云层偏好。自然视图明确说明摄影不是实时影像。高 / 中 / 低档云纹理为 4096 / 2048 / 1024 像素宽。

## 位置气象与海流查询

[Open-Meteo Weather](https://open-meteo.com/en/docs)：位置的十米风、来向和当前时间间隔降水量（mm）。[Open-Meteo Marine](https://open-meteo.com/en/docs/marine-weather-api)：Copernicus / Météo-France SMOC 海表流速和流向（m/s）。点查询有各自 UTC 有效时间；不是 GFS 快照的采样，也不是现场观测。来源使用 CC BY 4.0，保留链接。海流缺失不补成模拟值。

全局洋流动画与潜水取样的原数据管线保持，默认模拟场。时间栏只影响模拟洋流，不改变 GFS 或点查询时间。温盐剖面为示意值。未接入图层禁用，探索 / 潜水临时图层退出恢复。

## 首页、摄影与正文

独立 Three.js 深海首页：半分辨率 28 / 16 / 8 步雾光，五层不同焦距的微光颗粒，有限视差；减少动态效果冻结时间、取消视差。静态回退为本地 CSS 渐变与星点，没有新的摄影纹理。旧 WaterThreeJS MIT 许可保留在 `public/credits/WaterThreeJS-MIT.txt`；旧浅水参考图保留供历史对照，当前首页不用。

18 条摄影在 `public/species`，原始页面、作者与许可证记录在 `src/data/photographs.json`，保留 CC BY / CC BY-SA / public domain 署名。尖吻深海蜥鱼为 [NOAA Bathysaurus mollis ROV 实拍](https://oceanexplorer.noaa.gov/multimedia/daily-image-media-20210107/)；灯笼鱼为科级类群，摄影是管水母捕食灯笼鱼的 ROV 画面；金枪鱼标明水族馆摄影。未把全部影像称为深海摄影。

分类快照：[GBIF Species API](https://techdocs.gbif.org/en/openapi/v1/species)，保存于 `src/data/taxonomy.json`。补全通行的辐鳍鱼纲阶元并注明，缺失阶元不杜撰，科 / 属记录不指代单一物种。下载脚本与原许可记录保留。

新科普阅读为 `src/data/reading.ts` 中原创双语说明，按主题附 NASA、NOAA、NSF Unidata、GBIF 的资料链接，覆盖水循环、密度环流、上升流、海洋热量、酸化、食物网、分类及深海观测。用户地球参考图 `docs/references/earth.jpg` 仅用于本地对照，外部版权来源未知。本次没有部署发布。

### 2026-10-02 · 自适应云图与地球交互修订

- 云图采用 [Solar System Scope / INOVE 的 Earth Clouds 原生 8K](https://www.solarsystemscope.com/textures/)（CC BY 4.0），下载 URL 为 `https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg`。保存源文件、SHA-256、改动说明与署名；生成 2K/4K/8K 透明瓦片，浏览器按需加载。详见 `public/earth/cloud-tiles/ATTRIBUTION.md`、`manifest.json`、`scripts/build-cloud-tiles.py`。
- 摄影合成不是实时云图；8K 是原生采样，不是把旧 4K 图片放大。风、雨和云量预报继续使用已有气象服务与保存数据的回退策略。
- 实施与验收说明：`docs/earth-screen-space-update.md`；对照截图：`qa/earth-screen-space/`。

### 2026-10-03 · 太阳系 UI 共用与日期变更线修复

- 复用用户提供、已集成的太阳系工程 `styles/optical.css` 材质与 `ui/UIParticles.tsx` 粒子实现，提取为两边共同使用的样式和纯 Canvas 发射器，原作者署名保留。
- 没有新增外部摄影、字体或贴图。轨道底图继续使用已保存的 Solar System Scope / INOVE 地表摄影（CC BY 4.0），区域地表保留 Esri 与相应贡献者署名，云层继续使用已保存的原生 8K 云图。
- 实施与验证：`docs/solar-glass-update.md`；问题图和修复截图：`qa/solar-glass/`。
