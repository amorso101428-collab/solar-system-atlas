# iPad / Mobile 适配 V1 · 实现说明

> 对应方案书《Solar System Atlas — iPad / Mobile 适配 V1.0》。
> 本文件只记录"这一版做了什么、怎么验收、还差什么"，不含新的产品决策。

## 一句话

桌面端一行未改；iPad 与手机按各自的布局模式、手势和渲染档位单独工作，
数据模型、CameraDirector、视觉语言与桌面共用同一套。

## 布局模式（`LayoutMode`）

判定入口：`src/responsive/device.ts`

```
desktop            鼠标 / 触控板（含窄窗口）—— 原样
tablet-landscape   左景右档，面板 clamp(340px, 38vw, 470px)
tablet-portrait    上下分区：Scene 58% / Detail 42%（未开档案时 76% / 24%）
mobile-portrait    全屏场景 + 底部 Bottom Sheet（27 / 56 / 86vh 三档）
mobile-landscape   左景右档：Scene 68% / Detail 32%（未开档案时场景全宽）
```

判定依据是"视口短边 + 主指针类型"：

* 短边 < 600 → 手机；< 1100 → 平板；其余 → 桌面
* 只有"以手指为主指针"（`pointer: coarse` + `hover: none`）才算移动设备；
  iPad 接妙控键盘后 Safari 会报 `pointer: fine`，所以额外用
  UA + `maxTouchPoints` 兜底识别 iPadOS
* **桌面端永远落在 desktop**，窄窗口也不例外 —— 这是"桌面零变化"的开关

自检开关（只在开发/自检时用，不影响真机）：

```
?device=phone     强制手机布局
?device=tablet    强制平板布局
?device=desktop   强制桌面布局
?debug=1          暴露 window.__atlasLayout() / window.__atlasStore / window.__atlasCamera()
```

CSS 全部挂在 `.atlas[data-device='tablet'|'mobile']` 上（`src/styles/responsive.css`），
桌面端不匹配任何一条规则。

## 触摸手势（`src/gesture/`）

统一由 `GestureManager` 识别后分发，**没有任何组件自己监听 touchmove**：

```
canvas    单指拖动 = 旋转    双指 pinch = 缩放    双指平移 = pan    轻点 = 选中（交给 R3F 的 click）
detail    纵向滚动（touch-action: pan-y + overscroll-behavior: contain）
timeline  横向拖动 + 惯性（touch-action: none 只给轨道，避免被浏览器抢走）
sheet     顶部标题条纵向拖拽 → 吸附到 collapsed / half / expanded
```

`pointerType === 'mouse'` 的事件**完全不经过** GestureManager；
而且只有 `isTouchLayout()` 为真时才注册手势 —— 桌面（含触屏笔记本）
走的还是 V1 之前那套指针逻辑，一字未改。

相机仍然只有一套 `CameraDirector`：旋转写 `desired.yaw/pitch`、
缩放写 `desired.height`、平移写 `manualOffset`，与滚轮 / 中键 / 右键共用同一份阻尼与夹值。

## 移动端界面

| 组件 | 文件 | 说明 |
| --- | --- | --- |
| 顶部条 HOME / ☰ / EN | `src/ui/MobileNav.tsx` | 桌面返回 `null`，桌面上这段 DOM 根本不存在 |
| 底部动作条 VIEW / SEARCH | `src/ui/MobileNav.tsx` | 与时间轴错开，抽屉停在动作条上方 |
| 菜单抽屉（视图 / 对象 / 工具） | `src/ui/MobileMenu.tsx` | 复用桌面同一批 store 动作 |
| 详情 Bottom Sheet | `src/ui/MobileSheet.tsx` | 不改档案组件 DOM，只驱动 `.archive` / `.catalogpanel` |
| 全屏搜索 | `TopBar` + responsive.css | 输入框 16px（防 iOS 自动放大），右上角 ✕ |

档案组件（`BodyArchive` / `ObjectArchive` / `CatalogPanel` …）**一行未改**。

## 性能与 LOD

* DPR 上限：手机 1.35 / 平板 1.6 / 桌面 1.5（`src/responsive/renderProfile.ts`）
* 星场数量：手机 ×0.5 / 平板 ×0.7 / 桌面 ×1
* 标签 Semantic LOD：手机总览只留 importance 1，聚焦系统放开到 2；
  标签间距 ×1.35；小卫星标签在手机上不上场
* 命中半径：手机上整体 ×2.2（"看得见的小点，点得到的靶心"）
* 相机取景：手机竖屏默认落在**俯视实时太阳系**上（图示排列在 0.46 的
  宽高比下会压成一条细线），取景半径收到木星轨道，行星因此真的看得清

## 验收（`tools/ui-probe.ps1`）

```powershell
# 读布局模式、相机状态、各固定框的位置
pwsh -File tools/ui-probe.ps1 -Url "index.html?device=phone&view=atlas" -Width 390 -Height 844 `
  -Expr "JSON.stringify({layout: window.__atlasLayout(), cam: window.__atlasCamera()})"

# 截图（同一会话，图里看到的和量到的是同一个状态）
pwsh -File tools/ui-probe.ps1 -Url "index.html?device=tablet&body=earth" -Width 834 -Height 1194 `
  -ShotName ipad-portrait-earth.png
```

已核对的关键数字（2026-09 本轮）：

| 场景 | 期望 | 实测 |
| --- | --- | --- |
| 桌面 1600×900 | 与适配前同图 | 相机 height=113.95（atlasShot 公式值），`.timeline` 34,579 1506×159 未变 |
| iPad 竖屏未聚焦 | canvas 高 = 76% | 808×801 / 1054 |
| iPad 竖屏聚焦地球 | 58 / 42 分区 | canvas 611、panel 443 |
| iPad 横屏聚焦地球 | 面板 38vw | panel 459 / 998 |
| 手机竖屏聚焦地球 | 抽屉 27vh + 把手 | sheet 高 211 / 704，`::before` 宽 44px |
| 手机横屏聚焦地球 | 68 / 32 | canvas 556、panel 262（/818） |
| 手机搜索 | 全屏 + ✕ 可点 | panel 496×704，✕ 在 (446,12) 36×36 |

## 还没做的（下一版）

* **时间轴抽屉**：手机上目前是"停在动作条上方的紧凑时间线"，
  方案书 §21 的 `collapsed / expanded` 全高时间线抽屉还没做
* **AdaptiveQualityManager**：目前只有 PerfGovernor（按帧率调分辨率）
  与静态渲染档位，§33 的"逐项降级 DOF → SSAO → Bloom → 星场 → 小行星"
  还没接
* **重力 / 弹簧的手写物理**：Bottom Sheet 用的是 CSS spring 曲线，
  还没有"跟手 + 速度交接"的连续物理量
* **真机回归**：以上数字全部来自无头 Chrome；方案书 §40 要求的
  Safari / 真 iPad / 真 iPhone 矩阵仍需要在真机上跑一遍
* 首页圆形启动 UI 在手机上做了尺寸收敛，但还没有单独的移动版动效节奏
