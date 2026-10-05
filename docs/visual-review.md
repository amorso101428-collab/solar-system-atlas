# 最新摄影云层修正

![用户截图同一视角：移除灰膜后的摄影云层](../qa/cloud-correction/natural-close.png)

自然云层只使用保存的摄影透明度纹理，不再混入 GFS 云量底膜；厚云白色、无云区域透明。

![独立云量预报百分比图层](../qa/cloud-correction/forecast.png)

云量预报单独显示，摄影云层自动隐藏。截图中的地形服务失败状态仍存在，此次仅修正云层显示。

以下为历史对照，之前云量控制摄影细节的方式已经废弃。

---

# 最新视觉检查 · 极区与天气 · 2026-10-02

下列均为当前本地运行截图，未作后期修改。测试说明见 [验收记录](qa.md)，数据与许可见 [来源](resources.md)。

![北极：无云视图，检查极点缺口](../qa/polar-weather/north.png)

![南极：无云视图，检查极点缺口](../qa/polar-weather/south.png)

极区真实 DEM 未覆盖时使用参考椭球；冰盖是保存影像。北极白色区域来自后备纹理，不代表当日海冰实测。

![白色云层与最新云量状态](../qa/polar-weather/clouds.png)

云量随 GFS 有效时间更新，细节仍是保存的摄影纹理，不是最新卫星照片。

![原生 0.25° 风场与增密尾迹](../qa/polar-weather/wind.png)

![原生 0.25° 降水色区](../qa/polar-weather/rain.png)

![增密洋流，保留模拟标识](../qa/polar-weather/currents.png)

![390×844 英文低画质降水](../qa/polar-weather/mobile-rain-en.png)

![390×844 英文低画质洋流](../qa/polar-weather/mobile-currents-en.png)

![844×390 英文横屏洋流](../qa/polar-weather/landscape-currents-en.png)

![更换 DEM 后的勃朗峰地形](../qa/polar-weather/alps.png)

以下保留上一轮地理引擎截图作历史，其天气网格与 UI 不代表本次更新。

---

# 上一轮视觉对照 · 地理地球引擎 · 2026-10-02

用户最新要求是 Google Earth 式地表细节和导航。本轮采用全视野分级影像、真实高程与地理镜头，取代固定全球单球贴图。截图为本机实际运行，未对照片作后期加工。

## 城市靠近

![上海地表，实际 1440×900 画面](../qa/geospatial/shanghai-final.png)

道路、屋顶、河岸和街区来自动态加载的 Esri 影像。右侧导航支持北向复位、俯视 / 倾斜、连续缩放及全球复位；底部保留比例尺、坐标、视点高度、地表高程与署名。当前城市建筑仍为影像，不能把倾斜视角称为 Google 摄影测量三维城市。

## 山地高程

![勃朗峰真实地形](../qa/geospatial/alps.png)

坡面和山脊来自地形网格，不以影像亮暗模拟起伏。全球底图仍受各地区原生精度限制。

## 紧凑界面及科学阅读

![390×844 英文资料库](../qa/geospatial/mobile-library-en.png)

![390×844 球面降雨](../qa/geospatial/mobile-rain-en.png)

![844×390 深度剖面](../qa/geospatial/landscape-profile-en.png)

科普层保持在同一地球，降雨色标说明单位和有效时间。高分辨率底图不提高原有天气网格的科学分辨率。横屏侧栏为地球预留画布，温盐图保留刻度及示意数据说明。

![全球最终画面](../qa/geospatial/global-final.png)

用户地球摄影参考保存在 docs/references/earth.jpg；摄影角度、云系和时间不同。Google 三维数据尚需已启用服务的配置，见 [地理地球实现](geospatial-earth.md)。完整验证范围见 [验收记录](qa.md)，资源许可见 [来源记录](resources.md)。此前 qa/latest 保存旧 Three.js 地球，不代表本轮效果。
