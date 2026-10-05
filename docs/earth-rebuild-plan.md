# 地球重做方案 · 照片级真实 + 真实数据图层

> 参考：你给的真实卫星照片（自然去饱和、云层主导、哑光）
> 现有工程：`地球.blend`（已解出 3 张贴图与完整节点图）
> 原则：**弃用现在这套高饱和 CG 地球**，重做为照片质感；**所有数据必须来自真实公开数据源**

---

## 0. 问题诊断：现在为什么不对

| # | 现象 | 根因（现有代码） | 照片里应该是 |
|---|---|---|---|
| 1 | 陆地过绿、海洋过青 | `saturate3(landG, 1.34)` + `oceanRamp()` 峰值到 vec3(0.33,0.79,0.78) | 去饱和、自然色，陆地偏灰褐橄榄 |
| 2 | 整体像 CG 不像照片 | 纯 `pow(col, 1/2.2)` 输出，无色调映射 | filmic / ACES 近似，高光滚降 |
| 3 | 大气是"亮环"不是"雾" | `Atmosphere` 用 fresnel 幂 + AdditiveBlending | 从地面向外连续衰减的弥散散射 |
| 4 | **完全没有晨昏线夕阳** | 大气里只有 `smoothstep(-0.22,0.30,dot(up,sunDir))` 判太阳，**没有沿太阳方向的光学厚度积分**，也就没有波长相关消光 | 低太阳角时蓝光被散射掉，剩橙红 |
| 5 | 云是"贴上去的" | 无云影、无高度感、不能开关 | 云影投在海面、有厚度、可开关 |
| 6 | 地形没有起伏 | `uDisplace = 0.010`，且用的是掩膜 R 通道（不是高程） | 轻微但看得出的山脉/海沟起伏 |
| 7 | 高光过曝 | `pbr()` 返回后 ×3.0，且没做能量守恒 | 只在镜面点附近的小面积阳光闪烁 |
| 8 | 数据全是模拟的 | `buildSyntheticField()` 解析场 | 真实再分析/预报数据，带来源与时间戳 |

---

## 1. 视觉目标逐项拆解

### 1.1 底色与调色 → 照片质感
- 移除陆地的色度提升，改为**轻微去饱和**（陆地 ×0.88）
- 输出改用 **ACES filmic 近似**（Narkowicz 拟合），高光自然滚降、暗部不糊
- 曝光统一，不再逐项相乘

### 1.2 轻微真实地形起伏
- 数据：**GEBCO 2024**（15 弧秒全球陆海一体高程）→ 生成法线图 + 高度图
- 两级实现：
  - **法线扰动**（主要）：片元里对高度图求梯度、扰动法线 → 山脉海沟在光照下显形
  - **顶点位移**（辅助）：幅度 0.0015–0.004 × R，只影响轮廓边缘
- 关键：**高度图要有真实高程**，而不是现在这种 0–47 的低对比 R 通道

### 1.3 大气弥散
- 改成**单次散射光线步进**，不再是 fresnel 壳
- 两个成分：
  - **Rayleigh**（β ∝ 1/λ⁴）：天蓝、地平线泛白
  - **Mie**（气溶胶，前向散射强）：太阳附近的乳白辉光
- 密度剖面 exp(-h/H)：Rayleigh H≈8 km，Mie H≈1.2 km（按地球半径归一化）
- Alpha 用 Beer-Lambert 消光，保证边缘**渐隐**而不是硬边

### 1.4 晨昏线夕阳 ★
当前**完全缺失**，也是最能提升真实感的一项：
- 对每个采样点，**再沿太阳方向做一次光线步进**，求该点到太阳的光学厚度
- 透射率 T = exp(−β_λ · OD_sun)，**三通道用不同 β**（蓝 0.560 / 绿 0.240 / 红 0.115）
- 结果：太阳低角时蓝绿被散射殆尽 → 只剩红橙 → **自然出现夕阳带**
- 太阳附近叠加 Mie 前向散射 → 金色光晕
- 默认视角需**侧光**才看得到

### 1.5 海洋颜色与漫反射光辉（重点）
- **颜色**：由**真实水深**驱动查找表
  - 0–200 m 大陆架：青绿 (0.06, 0.42, 0.48)
  - 200–2000 m：过渡蓝 (0.02, 0.16, 0.34)
  - 2000–6000 m：深蓝 (0.01, 0.07, 0.20)
  - >6000 m 海沟：近黑蓝 (0.004, 0.03, 0.10)
- **漫反射光辉**：海面按粗糙介电质处理，F0≈0.02，粗糙度 0.12
  - 大面积**柔和天光反射**，而不是整片镜面
  - **阳光闪烁（sun glitter）**：只在镜面点附近，用高频噪声打碎成鳞光

### 1.6 云层（可开关）
- 用工程里解出的**真实 21k 云贴图**
- 三项增强：
  - **云影**：按太阳方向偏移采样，投到海面
  - **厚度感**：次表面散射（wrap lighting + 边缘银边）
  - **开关**：关掉后是纯净海面，更适合看洋流

---

## 2. 图层系统（全部可开关 · 全部真实来源）

### 2.1 数据源可达性实测

| 数据源 | 主机 | 实测 | 认证 |
|---|---|---|---|
| Copernicus Marine | data.marine.copernicus.eu | ✅ 200 | 需免费注册 |
| NOAA CoastWatch ERDDAP | coastwatch.noaa.gov | ✅ 200 | 无 |
| NOAA NCEI ERDDAP | ncei.noaa.gov | ✅ 200 | 无 |
| NOAA PSL（NCEP 再分析） | psl.noaa.gov | ✅ 200 | 无 |
| GEBCO | gebco.net | ✅ 200 | 无 |
| EMODnet ERDDAP | erddap.emodnet.eu | ✅ 200 | 无 |
| OSMC | osmc.noaa.gov | ✅ 200 | 无 |
| HYCOM | hycom.org / ncss.hycom.org | ❌ 不可达 | — |
| NASA OceanColor | oceandata.sci.gsfc.nasa.gov | ❌ 不可达 | — |
| NOAA AOML（漂流浮标） | erddap.aoml.noaa.gov | ❌ 不可达 | — |

### 2.2 图层清单

**海洋 OCEAN（重点）**

| 图层 | 主源 | 备源（免认证） | 分辨率 / 更新 | 许可 |
|---|---|---|---|---|
| 表层洋流 | Copernicus Marine GLOBAL_ANALYSISFORECAST_PHY | NOAA CoastWatch / OSCAR | 1/12° 逐小时 · 每日+10天预报 / 1/3° 5天 | 免费开放 |
| 海底地形 | **GEBCO 2024** | NCEI ETOPO 2022 | 15 弧秒 | 开放署名 |
| 海表温度 | NOAA **OISST v2.1** | EMODnet | 0.25° 每日 | 公有领域 |
| 盐度 | Copernicus | EMODnet | 0.25° | 开放 |
| 叶绿素 / 生产力 | EMODnet | Copernicus | ~4 km 日/月 | 开放 |
| 潮汐 / 海平面 | Copernicus | — | 1/12° | 开放 |

**大气 ATMOSPHERE**

| 图层 | 数据源 | 分辨率 | 许可 |
|---|---|---|---|
| 季风风向 | **NOAA PSL NCEP-NCAR 再分析 10m 风**（月气候态 + 逐日） | 2.5° | 公有领域 |
| 行星风带 | 由同一风场派生 | 2.5° | — |
| 气压带 / ITCZ | NCEP 海平面气压 | 2.5° | 公有领域 |
| 云量 | 工程内 21k 云贴图（可换 MODIS 日云量） | 21k | — |

**地形 / 构造 TERRAIN**

| 图层 | 数据源 | 说明 |
|---|---|---|
| 海沟 / 海岭 / 海山 | GEBCO 2024 派生 | 由水深自动提取 |
| 大陆架边界 | GEBCO（−200 m 等深线） | 矢量 |
| 板块边界 | PB2002（Bird 2003） | 矢量，学术引用 |

**生物 BIOLOGY**

| 图层 | 数据源 | 许可 |
|---|---|---|
| 物种分布点 | OBIS / WoRMS | CC-BY |
| 珊瑚礁分布 | UNEP-WCMC | 需确认非商业条款 |

**人类 HUMAN**

| 图层 | 数据源 | 许可 |
|---|---|---|
| EEZ 专属经济区 | Marine Regions | CC-BY |
| 海洋边界（IHO 五大洋） | Marine Regions / IHO | CC-BY |
| 航运密度 | EMODnet | 开放 |

### 2.3 每个图层的元数据契约

```ts
interface LayerSpec {
  id: string;
  name: { en: string; cn: string };
  group: "OCEAN" | "ATMOSPHERE" | "TERRAIN" | "BIOLOGY" | "HUMAN";
  renderer: "texture" | "particles" | "vectors" | "points" | "isolines";
  source: {
    name: string;        // "COPERNICUS MARINE"
    dataset: string;
    url: string;
    resolution: string;  // "1/12°"
    latency: string;     // "每日 02:00 UTC"
    license: string;
  };
  provenance: "MODEL" | "OBSERVED" | "DERIVED" | "ESTIMATED";
  defaultOn: boolean;
}
```

HUD 里每个图层开关旁显示 source · resolution · valid time · provenance，沿用现有的数据可信度条。

---

## 3. 渲染架构

```
每帧
├─ pass 1  地球表面
│    ├─ 昼面 albedo（真实贴图，去饱和）
│    ├─ 海底地形 → 海洋颜色 LUT
│    ├─ 法线扰动（GEBCO 真实高程）
│    ├─ 云层（可开关）→ 云影 + 次表面 + 银边
│    ├─ 数据图层混合（洋流 / 海温 / 盐度 / 叶绿素）
│    └─ 昼夜项混合（暗面 + 气辉）
├─ pass 2  大气（光线步进单次散射）
│    ├─ 视线方向积分：Rayleigh + Mie
│    ├─ 太阳方向积分：三通道消光 → 夕阳
│    └─ Beer-Lambert alpha（弥散渐隐）
└─ pass 3  矢量图层
     ├─ 洋流流线（GPU 粒子，已有）
     ├─ 季风箭头（新增）
     ├─ 板块边界 / EEZ / 海沟（线要素）
     └─ 物种分布点
```

---

## 4. 数据管线

在现有 `pipeline/` 上扩展，每个图层一个 ETL：

```
GEBCO / Copernicus / NCEP / OISST / EMODnet
        ↓  pipeline/etl_<layer>.py（裁剪 · 降采样 · 量化 · 校验）
   统一格式：OACF（标量/矢量场）/ GeoJSON（矢量）/ 高度图 PNG
        ↓
   /public/data/<layer>/manifest.json  +  分块数据
        ↓
   前端 loadLayer(id) → 渲染器
```

每个 manifest.json 必带 source / dataset / timestamp / license / resolution，前端据此渲染来源芯片。

---

## 5. 分阶段实施

| 阶段 | 内容 | 依赖 | 预估 |
|---|---|---|---|
| **P0 视觉重做** | 去饱和 + filmic；大气改光线步进；**夕阳**；云开关 + 云影；地形起伏 | 无新数据 | 主要工作量 |
| **P1 洋流真实化** | 接 Copernicus（或先用免认证 OSCAR）；现有 GPU 粒子渲染器不动 | Copernicus 账号 或 OSCAR | 中 |
| **P2 季风真实化** | NCEP 风场 ETL + 矢量箭头渲染器（夏/冬/对比） | 无 | 中 |
| **P3 其余图层** | 水深/海温/盐度/叶绿素/EEZ/板块/海沟 | 无 | 分批 |
| **P4 图层面板** | 分组、来源芯片、时间戳、默认开关 | P3 | 小 |

**P0 可以立刻开始，不等任何账号。**

---

## 6. 需要你确认的事

1. **Copernicus Marine 账号** —— 免费注册。有账号能拿到 1/12° 逐小时真实洋流 + 10 天预报；没有的话我先用免认证的 OSCAR（1/3°，精度低一档但仍是真实观测/再分析）。
2. **Earth_Displacement_43k.tif** —— 有的话给我，地形起伏直接用你的原始数据；没有我就用 GEBCO 2024。
3. **默认光照角度** —— 参考照片是全亮面，看不到夕阳。默认要哪种：
   - (a) 全亮面（像照片，最清晰，无夕阳）
   - (b) 侧光（有晨昏线与夕阳，一半在暗面）
   - (c) 缓慢自转（两者都能看到）—— **我推荐这个**
4. **图层默认开关** —— 建议：洋流开、云层开、海底地形开、季风关、其他关。
5. **性能取舍** —— 大气双积分较吃 GPU。桌面 14 步；移动端降到 6 步 + 关 Mie。

---

## 附：要改动的文件

| 文件 | 改动 |
|---|---|
| src/components/globe/Earth.tsx | 重写：去饱和、海洋 LUT、地形法线、云影/开关 |
| src/components/globe/Atmosphere.tsx | 重写：Rayleigh+Mie 双积分，出夕阳 |
| src/components/globe/WindArrows.tsx | 新增：季风矢量箭头 |
| src/components/globe/Terrain.tsx | 新增：真实高程法线/位移 |
| src/state/store.ts | LayerSpec 化，分组 |
| src/components/Hud.tsx | 图层面板重构 + 来源芯片 |
| src/lib/layerRegistry.ts | 新增：图层元数据 |
| pipeline/etl_*.py | 每个图层一个 ETL |
| public/data/ | 新增：分图层数据 |
