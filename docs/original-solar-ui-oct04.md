# 原太阳系 UI 恢复与地球接入 · 2026-10-04

用户要求以太阳系原工程为唯一外观基准。撤回此前自行设计的全局字号、按钮高度、蓝灰背景和标题卡片覆盖。

## 原工程依据

来源为 `/Users/quincy./Documents/ChatGPT/洋流网页/solar-system-atlas`。集成项目中的 `tokens.css`、`typography.css`、`atlas.css`、`atlas-v2.css`、`atlas-v3.css`、`atlas-v4.css` 与 `optical.css` 已逐文件核对，文本与用户提供的原文件一致。

`scripts/sync-solar-ui.mjs` 从太阳系样式读取实际声明，适配地球现有组件的选择器，生成 `src/styles/solar-ui-adapter.css`，不重新设计颜色、字体或控件。生产构建自动执行同步。`src/styles/earth-ui-bindings.css` 处理现有地球组件的布局与手机适配。

`src/styles/atlas-ui.css` 只保留明确要求的扩展：透明工具外层、内容卡片磨砂、保持完整场景、地球/图层 600ms 展开、触屏与减少动态效果处理。玻璃仍采用原工程的暖色光学边框；指针外观直接提取原工程 CSS，悬停粒子保留原有共享实现。

## 验证

- 原太阳系与地球桌面导航实际计算样式一致：PlexMono、11.5px、500 字重、30px 高、12px 圆角、6px/8px 内边距、原暖色双层渐变及文字颜色。
- 地球菜单实际字号 11.5px，内容展开时间 0.6s。
- 地球档案与设置外层透明，打开后画布仍为 1440×900。
- 390×844 中文、英文无文档横向溢出；触控按钮 44px，章节条支持横向滚动。
- 两套 TypeScript 检查、21 个现有检查文件和生产构建通过。

对照截图与计算样式：

- [原太阳系风格](screenshots/oct04-original-ui/solar.png)
- [地球桌面](screenshots/oct04-original-ui/earth.png)
- [地球菜单](screenshots/oct04-original-ui/earth-menu.png)
- [手机中文](screenshots/oct04-original-ui/earth-mobile.png)
- [手机英文](screenshots/oct04-original-ui/earth-mobile-en.png)
- [导航样式对照 JSON](screenshots/oct04-original-ui/navigation-metrics.json)
