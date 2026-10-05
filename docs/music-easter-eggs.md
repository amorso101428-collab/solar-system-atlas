# 音乐彩蛋 · 2026-10-03

- 打开「潜水」只显示列表，原音乐继续；点开「帕劳 蓝角」档案才播放 **Grand Blue — 湘南乃風（しょうなんのかぜ）**，其他潜点不触发。
- 提交「丹麦／丹麥／Denmark／Danmark」搜索、选择丹麦搜索结果或点击地球上的丹麦标注，播放 **What A Life — Scarlet Pleasure**。「丹麦海峡」不触发国家彩蛋。
- 彩蛋采用完整歌曲单次播放：关闭档案、返回列表或打开普通面板不会提前切歌。只有歌曲的原生 `ended` 事件才恢复此前背景音乐，取消结尾交叉淡出和自动重复。手动静音会暂停，重新开启从暂停位置继续；明确触发另一首彩蛋仍可切换。
- 两首共用顶部音乐开关，♫ 曲目玻璃浮层内也能开关。静音时切换入口只更新待播放曲目，不会重新开声。刷新仍遵循项目原有的每次访问默认开启规则，浏览器限制有声自动播放时由首次交互解锁。
- 音频失败会显示可重试状态与官方曲目链接，不会自动改播不相关歌曲。

## 本地资源

两首均使用用户提供的 `/Users/quincy./Music/网易云音乐` 中相应 NCM 文件，转换为完整 MP3，保留原文件。页面运行只引用项目资产，不依赖用户电脑原目录或网易云音频外链。

| 歌曲 | 项目文件 | 浏览器读取时长 |
| --- | --- | --- |
| Grand Blue | `public/audio/easter-eggs/grand-blue.mp3` | 313.028 秒 |
| What A Life | `public/audio/easter-eggs/what-a-life.mp3` | 185.942 秒 |

容器格式核对参考：[ncmdump 的格式实现](https://github.com/taurusxin/ncmdump/blob/main/src/ncmcrypt.cpp)。未安装或运行该项目的二进制工具。

官方曲目记录：[Grand Blue](https://music.apple.com/jp/album/grand-blue/1391490753?i=1391490760)、[What A Life](https://music.163.com/song?id=1839410613)。这些用户音频独立于原背景专辑的许可记录。

本地 Node 预览提供音频 MIME、HTTP 字节区间、HEAD 与缓存支持；浏览器按播放需要读取音频。首次加载首页不会预加载两首彩蛋歌曲。

## 验证

地球与太阳系类型检查、21 项项目检查及生产构建通过。回归测试覆盖静音触发、背景恢复、快速连续切换、过期播放请求、重新开启与旧暂停定时器、音源错误、帕劳独立触发、关闭档案后继续、最后一秒保持原曲、结束事件恢复、双语触发及两份 MP3 资源；服务测试覆盖首段、末段、无效范围和 HEAD。

浏览器核对了两首歌曲的媒体地址、时长及播放推进；检查了搜索丹麦、打开国家、帕劳触发、普通潜水列表不触发、静音后切换和 390 × 844 浮层边界。

本次帕劳回归实测：点开档案播放《Grand Blue》，约 110 秒返回潜水列表后继续播放；原生播放器完整推进到 313.028 秒（5 分 13 秒）才结束，随后恢复背景曲，背景曲已继续推进超过 38 秒。浏览器未记录运行错误。

截图：[帕劳彩蛋](screenshots/oct03-music/palau-grand-blue.png)、[丹麦彩蛋](screenshots/oct03-music/what-a-life.png)、[手机曲目浮层](screenshots/oct03-music/music-mobile.png)。

### 完整播放兼容处理

彩蛋在用户点击时以当前设定音量起播，并保持稳定音量；不使用定时器从无声渐入，减少浏览器有声播放策略中断的可能性。旧换曲任务退休音频时核对播放代次，避免停掉后来复用的音轨。浏览器策略参考：[W3C Autoplay Policy Detection](https://www.w3.org/TR/autoplay-detection/)、[WebKit macOS 自动播放策略](https://webkit.org/blog/7734/auto-play-policy-changes-for-macos/)。
