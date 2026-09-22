# HUMAN ARTIFACTS — Design System

> 目标：一打开就像一张巨大的宇宙工程图被截取下来，而不是一个 3D 太阳系 demo。
> 视觉优先于数据规模；出现「功能很多但画面很乱」时，优先删功能。

---

## 1. Color Tokens

```css
--bg:            #050505;  /* 绝对黑，不做蓝紫渐变 */
--bg-soft:       #0b0b0a;
--ink:           #e7e1d5;  /* 主文字，暖白 */
--ink-dim:       #b9b2a4;
--ink-muted:     #7e7a72;  /* 次级标签 */
--ink-faint:     #59554e;  /* 刻度、年份 */
--line:          #34342f;  /* 次级轨道 */
--line-bright:   #7d7a70;  /* 主轨道 */
--line-measure:  #6b6455;  /* 引线 / 标尺 */
--node:          #c58a55;  /* 节点暖橙 */
--accent-cyan:   #74b7c2;  /* 地球 / 冷色高亮 */
--accent-yellow: #b8a955;  /* 月球 / 太阳系内侧 */
--accent-red:    #9a5c4c;  /* 火星 */
```

配比铁律：**90% 黑灰米白 + 8% 暖色 + 2% 冷色高亮**。
发光只允许出现在：hover 对象、当前选中对象、当前轨道、镜头推进中的关键节点。

## 2. Typography

| 用途 | 字体 | 规格 |
| --- | --- | --- |
| 数据 / 标签 / 编号 | IBM Plex Mono | 10–12px，letter-spacing .14–.26em，uppercase |
| UI 标题 | Inter | 300/400 weight，大字距 |
| 中文正文 | 系统无衬线 | 与 Inter 同尺寸 |

行高：标签 1.2 / 正文 1.75。数字一律等宽，NORAD / 年份 / AU 全部 mono。

## 3. Orbit Line Tokens

| 层级 | 宽度 | 透明度 |
| --- | --- | --- |
| Primary orbit（行星） | 1.0px | 0.30 |
| Secondary orbit（月球 / 卫星） | 0.5px | 0.16 |
| Measurement / leader line | 0.5px | 0.22 |
| Hover | 1.0px | 0.72 |
| Selected | 1.5px | 1.0 + 极轻 glow |

ATLAS 姿态（开场侧视图）里，行星盘内的卫星轨道是**一圈一圈等距的正圆**——
这是"读得出有几圈"的前提；偏心与倾角交给右键展开之后的 REAL 姿态，
而且越靠外圈越淡。行星自身的日心轨道始终是带轻微偏心的椭圆。

## 4. Label Tokens

- 默认态：只显示行星名与当前关注对象的标签。
- Hover：目标标签 + 引线 + 年份。
- 选中：目标标签常亮，同轨道其他对象降对比（不要完全消失）。
- 标签位置由 3D 投影驱动，但排版完全由 DOM 控制（保持科学制图的清晰度）。

## 5. Panel Tokens

```
宽度 420px（桌面）/ 全宽底部抽屉（窄屏）
背景 rgba(6,6,6,.82) + backdrop-blur(14px)
边框 1px --line，直角或 2px 微圆角
内边距 28px，行距 18px，数据行 uppercase mono 11px
禁止：厚卡片、投影堆叠、圆角 16px 以上的“SaaS 面板”
```

## 6. Motion Timings

| 动作 | 时长 | 缓动 |
| --- | --- | --- |
| Hover 反馈 | 160–220ms | ease-out |
| 标签出现 | 200ms | ease-out |
| Filter 响应 | 320–480ms | ease-in-out |
| Panel 进入 | 520–760ms | cubic-bezier(.22,.61,.36,1) |
| Camera Dive | 1200–2000ms | cubic-bezier(.33,0,.2,1) |

禁止 bounce / elastic / 夸张缩放 / 高频闪烁。整体像精密仪器。

## 7. Camera States

```
OVERVIEW ──click──▶ SYSTEM_FOCUS ──auto──▶ OBJECT_FOCUS ──▶ ARCHIVE
   ▲                                                          │
   └────────────── RETURNING ◀── ESC ─────────────────────────┘
```

- 相机 FOV 22°，接近正交，保证“工程图”透视感。
- 相机运动只有位移 + 轻微推轨，禁止旋转眩晕。
- 所有过渡由一个统一的 tween 驱动，不用散落的 setTimeout。

## 8. Object Categories

`EARTH` / `MOON` / `MARS` / `OUTER` / `SMALL BODY` / `SOLAR` / `DEEP SPACE`
—— 用于筛选、颜色与轨道分层。

## 9. Scales

```
position = scientific-ish   （顺序真实，距离压缩）
size     = artistic         （行星尺寸可读优先）
orbit    = diagrammatic     （椭圆 + 轻微倾角，不是纯圆）
```

## 10. Background Layers

```
01 pure black
02 extremely subtle star field（星点极小、极暗，不要成为主角）
03 barely visible dust / grain
04 orbit system
05 DOM labels + UI
```
