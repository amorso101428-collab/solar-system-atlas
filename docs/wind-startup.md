# 风场与洋流首次开启修复 · 2026-10-03

## 变化

- 流线构建原先在相机移动时取消，之后依赖 `moveEnd` 重启。首次构建还未完成时，动画循环尚未启动，缺少结束事件就会一直空白。现在开启图层立即启动恢复检查，实际视角稳定后自动构建；暂停时间或减少动态效果时也能完成首次构建。已有流线在重建期间保留，隐藏页面和退出图层会取消任务。
- 风场先读取项目保存的预报并显示流线，再检查在线更新。可选云量数据失败不会阻止有效的风场和降水显示，同一版本复用已解码的风场数组。页面继续显示实际预报有效时间与更新状态。
- 增加东北／东南信风带、两半球西风带、两极东风带及南亚、东亚、澳大利亚北部季风区名称。标注沿用固定字号与碰撞避让，可用鼠标、触摸或键盘打开说明；中英文同步切换。
- 说明包括所在气候带、盛行来向、温湿性质、夏冬差异和来源。名称提供长期气候背景，不能把每条当天预报流线判定成某种季风。

## 验证

- TypeScript 类型检查、20 项项目检查及生产构建通过。
- 新增回归场景：首次构建被相机移动取消且没有 `moveEnd`、暂停并减少动态效果、页面隐藏后恢复、预报更新服务等待、可选云量失败、同版本数组复用。
- 浏览器单次开启：桌面风场约 245–246 条流线、洋流 139 条；390 × 844 手机风场 109 条。数量随视角与屏幕尺寸自适应。
- 已检查手机标注点击、英文季风夏冬说明、中文恢复；验收期间未记录浏览器控制台错误。

截图：[桌面风场](screenshots/oct03-wind-startup/wind-first-open.png)、[洋流首次开启](screenshots/oct03-wind-startup/currents-first-open.png)、[手机风场](screenshots/oct03-wind-startup/wind-mobile.png)、[季风说明](screenshots/oct03-wind-startup/monsoon-details.png)。

## 科普来源

- [NOAA · Global atmospheric circulations](https://www.noaa.gov/jetstream/global/global-atmospheric-circulations)
- [NOAA · Trade winds](https://oceanservice.noaa.gov/facts/tradewinds.html)
- [NWS · Monsoon information](https://www.weather.gov/twc/Monsooninfo)
- [香港天文台 · 冬季东北季风](https://www.hko.gov.hk/en/education/weather/monsoons/00068-why-the-winter-monsoon-in-hong-kong-is-generally-called-the-northeast-monsoon.html)
- [澳大利亚气象局 · Monsoon](https://www.bom.gov.au/resources/learn-and-explore/climate-knowledge-centre/climate-factors/monsoon)
