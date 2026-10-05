# 地球海洋图谱 · Solar → Ocean Atlas

正式网站：https://solar-system-atlas.pages.dev/ 。太阳系入口 `/solar/`：选择地球，在档案点击「探索地球」进入地球图谱；「← 地球系统」返回。两端共享语言，保留进入前的太阳系年份和排列方式。

地球与太阳系默认使用同一套深色背景板和界面动效。窄阅读面板采用可折叠章节目录，展开后纵向列出完整标题；手机端增加留白并允许长标题换行。

海洋端采用地理地球引擎 CesiumJS：高清分级卫星影像、真实高程地形、Google Earth 式平移 / 缩放 / 倾斜 / 飞到地点，以及北向复位、比例尺、经纬度与高度。完整可见视野按屏幕精度细化，不再将单张全球贴图放大。界面为深色悬浮搜索与导航，保留圆角科普阅读侧栏。太阳系项目、双语资料和深海首页保留。

在线近景默认使用 Esri World Imagery 卫星／航空摄影，通过同源接口按需加载和缓存；远景及网络故障保留项目内的地球摄影贴图，不自动切换白色街道底图。影像不是实时摄影。国内天地图卫星影像仍支持用户自己的 Key，GeoQ 街道图仅在显式配置时使用。

全部空间图层显示在三维地球上。顶部「地球」选择自然、洋流、全球风场、全球降水；深海剖面在侧栏打开。原 `?view=map` 链接进入三维洋流，`?view=depth` 打开剖面，均保留地球。分析会隐藏云层，退出后恢复用户偏好。「探索路径」代替「教学」；临时图层退出时恢复。

## 运行

GitHub 工程的原始瓦片、图片与静态资源保存在 `source-assets/` 无损资源包中，避免仓库逐个列出上千个素材文件。`npm ci` 自动校验 SHA-256 并还原，构建和测试也会自动补齐；所有原资源路径保持不变。需要单独还原可运行 `npm run prepare:assets`，修改素材后运行 `npm run pack:assets` 更新包。原始素材不是降分辨率缩略图，构建后的云端发布包仍为约 62 个文件。

需要 Node.js 22+。新环境：

```sh
npm ci --registry=https://registry.npmjs.org
npm ci --prefix integrations/solar-system-atlas --registry=https://registry.npmjs.org
npm run typecheck
npm run typecheck:solar
npm test
npm run build
npm run preview
```

整合后的 Cloudflare Pages 发布包：`npm run build:pages`，再运行 `npm run test:pages` 和 `npm run preview:pages`。资源路径保持不变，由 `_worker.js` 按范围读取资源包并还原 gzip 文本；**不要用普通静态文件服务器直接托管 dist-pages**。普通静态服务器可用未整合的 `dist`。源码与原始图片保留；生成目录省去浏览器不使用的原始 NetCDF。

预览默认 `http://127.0.0.1:4178`；本次运行地址 `http://127.0.0.1:4182/solar/`。联合构建使用 esbuild，隔离 React 18 / Three 0.160 海洋端和 React 19 / Three 0.186 太阳系端，包含轨道 worker。`npm run dev` 只预览海洋端；完整衔接使用生产构建。

## 数据与阅读

- 洋流仍为原模拟场。高 / 中 / 低档分别为 4800 / 2800 / 1300 条轨迹，优先填充可见海面；经纬度与贴图统一，绘制阶段检查海陆掩膜。时间播放 / 暂停控制洋流演示。
- 风场：连续风速色带和沿向量移动的尾迹；降水：蓝、青、绿、黄、红、紫强度图。使用 NOAA/NCEP GFS 原生 0.25°、1440×721 全球网格，覆盖南北极；风 / 雨 / 云量按预报有效时间自动检查更新。图例标注 m/s、mm/h 和 UTC 有效时间。
- 位置查询仍使用 Open-Meteo 天气预报与 Copernicus / Météo-France SMOC 海表流速。点查询与 GFS 全局快照是不同产品，缺失值不虚构。
- 地面上方最低 30 米，开启地形碰撞，按实际地形保护镜头；高清影像和地形均按当前视野分级请求。可搜索城市、山地或经纬度，双击靠近，左右键拖动均围绕地心旋转，滚轮及双指缩放。Google 三维摄影城市需配置已启用 Map Tiles API 的密钥。
- 档案使用单一滚动正文、可点击章节总纲、阅读进度和嵌套返回。增加双语水循环、环流、上升流、深层水团、热量、酸化、深海生态、分类与观测方式阅读，附来源链接。
- 温盐剖面有 0–11,000 m 线性刻度、独立温度 / 盐度轴、点击与滑块读数；属于示意值。18 条生物记录保留摄影、逐图许可、GBIF 分类、可展开阶元和关联生物。
- 首页保留实时深海雾光与柔焦浮游微光；减少动态效果可冻结运动。进入图谱释放首页的独立渲染资源。

天气自动更新：`npm run preview` 和 Vite 开发服务器包含同源 `/api/environment`。浏览器每分钟检查，服务器每小时向官方 NCSS 请求一次最新 GFS，失败保留上次数据、10 分钟后重试；成功无需重新构建。自然云层只显示保存的卫星摄影合成，去除暗背景与灰膜；云量预报是独立百分比色彩图层，不再影响摄影云层。两者不会同时显示。纯静态文件托管只显示保存快照。手动保存快照可运行 `node scripts/fetch-weather.mjs`；Python 旧入口仅转调 Node，不再要求 NumPy。原始 NetCDF、UTC 时间和单位均保留。

资源：[来源记录](docs/resources.md) · [验收记录](docs/qa.md) · [参考对照](docs/visual-review.md) · [云端发布记录](docs/cloudflare-deployment.md) · [统一界面验收](docs/unified-earth-solar-ui-20261005.md)。本地 QA 截图与生成的构建目录不纳入 Git；源码和原始素材保留，可按上面的命令重新构建。
