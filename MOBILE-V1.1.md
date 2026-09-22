# iPad / Mobile 适配 V1.1 · Hardening 实现说明

> 对应方案书《Solar System Atlas — Mobile V1.1 Completion & Hardening Plan》。
> V1 的 [MOBILE-V1.md](MOBILE-V1.md) 继续有效，本文件只写 V1.1 补上的部分。

## 一句话

V1 把移动端"做出来"，V1.1 把它"做稳"：时间轴抽屉与详情抽屉都换成连续物理，
画质从"只降 DPR"升级成 15 级阶梯，触摸手势做了冲突隔离，
并补齐了旋屏 / 视口 / 键盘 / 滚动锁这些真机才会暴露的问题。桌面端仍然零变化。

## Desktop 冻结：回归证据

冻结基准（1600×900 窗口 / 1574×760 视口）：

```
camera height = 113.9516    target.x = 101    yaw = 0    pitch = 0
.timeline 34,579 1506×159   .topbar 0,0 1574×63   .masthead 34,88 123×125
行星标签屏幕坐标（MERCURY…PLUTO）与 HEAD 逐字符相同
像素区域亮度（太阳 / 木星 / 小行星带）：HEAD 2318/433/2216  V1.1 2318/433/2212
```

注意：`tools/shot.ps1` 用 `--headless=old` + `--virtual-time-budget`，
截图可能落在场景还没铺完的那一帧上（会看到"星球变小、轨道消失"的假象）。
桌面回归对比必须用 `tools/ui-probe.ps1`（先等帧、再读数值、同一会话截图），
或者两边都用 probe 取图。这一条写进流程，避免下次再被假差异骗到。

## 1. 统一的弹簧物理（`src/motion/`）

```
spring.ts        x'' = -k(x-target) - c·x'（k=260 / c=30），8ms 子步进防发散
DrawerMotion.ts  手指跟手 → 松手接速度 → rAF 推弹簧 → 停稳后回调一次
```

两条纪律：不做离散判断（禁止 `if (dragY > 阈值) setExpanded(true)`）、
不每帧写 React state（物理量在模块对象里，逐帧只写 CSS 变量）。

## 2. Timeline：从 Slider 变成两态抽屉（§2 – §6）

* collapsed = `72 + 安全区`（实测 72.2px），expanded = `clamp(0.46vh, 320, 520)`
* 竖向拖动 → 抽屉跟手；横向拖动 → 仍然拖年份（先判方向，再决定归属）
* 松手按"速度 + 位置"吸附到 collapsed / expanded（`resolveSnap`）
* 展开后出现事件清单（到此刻为止的 8 条重要事件，点击直接聚焦）
* 连续时间：场景的时间源是浮点 `timelineTime.target`（1997.438 这种），
  store 里的年份只用于 UI 文字、按 50ms 节流写；桌面仍然两条一起写，
  所以桌面行为与 V1 完全一致，而移动端拖动时行星 / 月球 / 航天器 / 彗星连续滑行

## 3. Bottom Sheet：从三档状态变成连续位置（§7 – §10 / §28）

* 位置量 `sheetProgress`：0.18（collapsed）/ 0.48（half）/ 0.88（expanded），
  中间任意位置都停得住，松手才吸附
* 只改 `transform: translate3d(0, var(--sheet-y), 0)`，不动 top/height，
  拖动过程不触发布局；`--sheet-expanded-h` 由 visualViewport 写入
* 入场动画交给弹簧（可被手指立刻打断）：CSS keyframes 的 `fill: both`
  会永久压住 inline transform，所以这里必须 `animation: none`
* 嵌套滚动（§9）用 touch 事件 + `preventDefault` 仲裁：

```
抽屉没展开                    → 上下都拖动抽屉
已展开 + 内容不在顶部          → 让内容滚
已展开 + 内容在顶部 + 向下拖    → 收起抽屉
已展开 + 内容在顶部 + 向上拖    → 让内容滚
```

与方案书 §20 的差异：Sheet 的 `touch-action` 是 `pan-y` 而不是 `none`。
因为这里的抽屉本身就是滚动容器，`none` 会把详情正文的滚动一起关掉；
真正需要独占的是标题条（`.archive__top` 仍是 `touch-action: none`）。

## 4. AdaptiveQualityManager（§11 – §19 / §29 / §30）

`src/performance/`：阶梯与档位（QualityProfile）、采样与状态机
（AdaptiveQualityManager）、接进渲染循环（QualityController）。

15 级阶梯，每次只走一步（按方案书 §12 的顺序，跳过本站没有的效果）：

```
 1 bloom-quality        6 texture-quality(aniso 8→4)   11 belt-density-2
 2 star-count           7 star-count-2                 12 dpr-2
 3 asteroid-detail      8 corona-detail                13 label-count-2
 4 bloom-strength       9 postfx-off                   14 texture-low
 5 label-count         10 dpr-1                        15 star-safe
```

档位 = 阶梯前缀长度：ULTRA 0 / HIGH 1 / MEDIUM 4 / LOW 8 / SAFE 15。

* N/A（本站不存在，不假装有）：shadow map（渲染器没有阴影）、SSAO、DOF、god rays
* 采样：1s 窗口统计平均帧时 + P95；连续 2 个窗口超预算（>16.7×1.25ms）才降级，
  连续 5 个窗口宽裕（<16.7×0.8ms）才升级；每次换档后 cooldown 1800ms
* `?quality=low|medium|high|ultra|safe|auto` 可强制档位（自检用）；
  desktop 不参与自适应，PerfGovernor 原样保留（那是被冻结的 V1 行为）
* 贴图档位：**分级素材 + 各向异性/mipmap**（见下节），不重新加载、不 dispose
* §30：CPU 占用率 / GPU 利用率 / 真实显存一律输出 `N/A`

## 4.5 贴图分级（§18 / §19）

`tools/make-texture-tiers.ps1` 预先把会被上传到 GPU 的贴图（`public/planets`、
`public/moons`、`public/textures` 共 35 张）缩成两档，仓库因此多约 5 MB：

```
earth_daymap-2k.jpg (2048×1024)  ->  earth_daymap-1k.jpg (1024×512)  ->  earth_daymap-512.jpg
```

`useTexture` 在**加载那一刻**挑档：桌面 / 平板用原图 2k，手机用 -1k，
画质降到 LOW / SAFE 用 -512；分级图 404 时自动回退原图。

20 张 2048 贴图带 mipmap 约 220 MB 显存，手机上是把 WebGL 上下文顶掉的风险；
降到 1k 是 1/4，降到 512 是 1/16。实测：手机全部请求 `-1k`，桌面仍然全部 `-2k`。
分级只在加载时决定——中途降档不会重新拉一遍贴图（那会带来一次请求 + 上传卡顿）。

`public/images/objects` 里的档案照片**不做分级**：它们是普通 `<img>`，
不占显存，不该让仓库多背十几 MB。

## 5. 手势硬化与 iOS 视口（§20 – §28）

```
tap vs drag     手指 10px / 鼠标 5px 才判定为点击（原先统一 5px，手指必然误触）
手势隔离        canvas 只认从画布开始的指针；抽屉 / 菜单 / 时间轴各管各的
focus cancel    第一次有效拖动就取消镜头 tween，交给用户（V1 已有，本轮复核）
旋屏            store.focus / sheetState 全部保留，只重算取景偏移与面板位置
visualViewport  同步 --vv-height / --vv-offset-top / --app-height，只改布局指标
软键盘          html[data-keyboard='open'] 时全屏搜索按可视高度收敛
滚动锁          html[data-sheet-open='yes'] body{overflow:hidden}
                （只锁 overflow，不给 body 加 touch-action，否则抽屉内部也滚不了）
```

## 6. 自检工具（§29 / §34 / §36 准备）

`tools/ui-probe.ps1` 新增三个能力，用来在没有真机时先把真机动作跑一遍：

```powershell
# 注入真实手指轨迹（CDP Input.dispatchTouchEvent）
pwsh -File tools/ui-probe.ps1 -Url "index.html?device=phone&view=atlas" `
  -TouchPath "250,596;250,560;250,500;250,440"

# 轻点（走 Chrome 手势识别，比手搓 touchStart/End 可靠）
pwsh -File tools/ui-probe.ps1 -Url "index.html?device=phone&view=atlas" -Tap "248,232"

# 中途改视口 = 旋屏（Emulation.setDeviceMetricsOverride）
pwsh -File tools/ui-probe.ps1 -Url "index.html?device=phone&body=earth" -Resize "844,390"

# 与截图脚本同一个 headless 环境（排查环境差异时用）
pwsh -File tools/ui-probe.ps1 -Url "index.html?view=atlas" -Headless old
```

两条踩过的坑，写下来免得再浪费一轮：

* 手搓 `touchStart/touchMove/touchEnd` 在 headless 下**不可靠**（Chrome 的手势识别
  会整段吞掉，表现为页面里一个事件都没收到）。轻点请用 `-Tap`；
  拖动出现"没反应"时先看注入点日志，再重跑一次。
* 手搓注入的数字里有 `-1k` / `-2k` 这种字段时，别用 PowerShell 的
  数组参数传（外部 shell 会把逗号数组拆成多个参数），一律用 `;` 分隔的字符串。

调试钩子（`?debug=1`）：`__atlasLayout()` / `__atlasCamera()` /
`__atlasQuality()`（档位 + 阶梯步数 + 参数 + draw calls / 几何 / 贴图）/
`__atlasPerf()`（FPS / 帧时 / P95 / DPR / 画质）。

`tools/diag.html` 是"这台设备怎么看待自己"的探针页：打印 pointer / hover、
maxTouchPoints、visualViewport、safe-area。真机 QA 时先开它，
能立刻区分"是我们判错了设备"还是"这个浏览器真的不支持"。

## 7. 本轮实测结果

| 项目 | 期望 | 实测 |
| --- | --- | --- |
| 桌面相机 / 标签 / 面板几何 | 与 HEAD 一致 | 完全一致 |
| 手机时间轴抽屉 collapsed | 72px + 安全区 | 可见 72.2px，`--tl-y` 251.8px |
| 手机时间轴抽屉（触摸上拖） | 吸附 expanded | `expanded=true`，`--tl-y=0` |
| 详情抽屉（触摸上拖 210px） | 吸附 half | `state=half`，`--sheet-y=281.6px` |
| 嵌套滚动（expanded + 顶部 + 下拖） | 收起抽屉，相机不动 | `state=collapsed`，yaw/pitch 未变 |
| 单指旋转（画布横拖 100px） | yaw ≈ 0.32rad | 0.3199（= 100×0.0032） |
| 旋屏（390×844 → 844×390） | focus 保留、只重算偏移 | `PLANET:earth` 保留，height 6→6 |
| 自适应画质（SwiftShader 21fps） | 逐级降档 | HIGH→MEDIUM→LOW，cooldown 生效 |
| 同目标聚焦 ×10 的资源回归 | 不增长 | 贴图 42→42，几何 141→142 后持平 |
| 轻点太阳（synthesizeTapGesture） | 选中并聚焦 | `focus=PLANET/sun`，相机 599→27.4 |
| 贴图分级 | 手机 1k / 桌面 2k | 手机 44 个资源全是 `-1k`；桌面 31 个全是 `-2k` |

几何数在"遍历不同天体"时会随 LOD 揭示的物体增加（141→156），
但对同一个目标重复聚焦 10 次后停在 142，说明不是逐次泄漏。

## 8. 仍然没做 / 需要真机

* §33 十分钟长稳测试 / §37 异常矩阵：headless + SwiftShader 的帧率不代表真机，
  必须在真机上跑（脚本已就绪：`-TouchPath`、`-Resize`、`?quality=`）。
* 双指手势已在探针里跑通（`-TouchPath` 每帧写 4 个数字 = 两指）：
  捏合 100→200px 让 height 599→299.6，双指平移 50px 让 manualOffset=(-42.5,18.5,-38.3)。
  真机上仍需复核多指的真实时序（探针是逐帧合成，不是并发的两根手指）。
* KTX2 / WebP 管线：当前分级用的是 JPEG（System.Drawing 写不出 WebP），
  体积还能再小一半；等有 ktx2 工具链时替换 `make-texture-tiers.ps1` 即可，
  `useTexture` 的挑档逻辑不用动。
* §32 前后台：采样在 `document.hidden` 时会停（不把暂停当卡顿），
  rAF 本身由浏览器节流，没有额外做"切后台暂停昂贵动画"。
* §44 视觉微调：留到物理稳定之后（本轮刻意没动排版与视觉）。
