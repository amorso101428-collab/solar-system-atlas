# Cloudflare Pages 发布

现有项目：`solar-system-atlas`；生产分支：`main`；账户：`6ecae33cc6a6cd0f902b2e356286ad5d`。

运行 `npm run build:pages` 生成 `dist-pages/`，网页上传选择此目录；`dist/` 保留用于本地预览。`npm run deploy:pages` 使用 Cloudflare 官方 Wrangler 上传。首次使用 Wrangler 需账户读取、用户读取、Pages 写入及官方默认离线续期授权。如果本地回调不通，可使用 `npx wrangler@4.138.0 login --device --scopes account:read user:read pages:write`。Cloudflare 授权服务若无法连接，现有已登录控制台仍可直接上传 `dist-pages/`。

首页继续进入 `/solar/`。从太阳系选择地球，再点击海洋入口，使用 `/?view=globe&from=solar…` 进入海洋。

## 无损资源整合

`scripts/build-pages.mjs` 调用资源整合脚本，将 1,487 个资源合并为 32 个不超过 4 MiB 的二进制包，手机修复版发布目录共 62 个文件、173,430,698 字节。189 个文本资源使用 gzip；图片不降质。资源与解包内容逐一进行 SHA-256 对照，不改变原资源路径。`_worker.js` 按原 URL 从包中读取字节，支持 Range 和完整响应两种情况，并缓存解包后的资源。`_routes.json` 将打包资源与 `/api/*` 路由到 Worker，未打包的大文件和入口文件仍直接静态分发。打包资源请求会计入 Pages Functions / Workers 用量。

本地 public 原图不受打包影响。`npm run test:pages` 验证云端固定源、缓存、异常处理，以及打包瓦片的字节一致性、不同缩放级别和极区边缘路径。运行该测试前先完成 `npm run build:pages`。

## 云端数据

- 默认近景 Esri World Imagery 卫星／航空摄影：同源固定上游代理、JPEG 校验和一天缓存。上游失效时保留本地 NASA 摄影底图，不自动切换白色街道图。GeoQ 街道图仅供手动选择。
- CelesTrak 轨道：固定 active 目录、两小时缓存；失败由客户端切换到保存的轨道数据。
- 全球风雨：使用项目保存的 GFS 快照，并显示原有效时间。本地 Node 服务器的 GFS 自动更新服务尚未迁移到边缘运行时。
- 逐点天气与海流：Open-Meteo 在线接口。

响应头沿用原项目安全策略，仅增加实际地图、地形及天气源；无哈希的入口脚本要求重新验证缓存，避免新版入口仍使用旧代码。

## 更新前备份

本次发布前的生产部署 `3686a083-9d5c-44f9-b6e2-13dafabf5c3d` 已保留，旧版独立地址：https://3686a083.solar-system-atlas.pages.dev/ 。更早的生产部署 `5c7537fe-9402-4233-811b-53c2031741bc` 也仍保留。回滚可在项目部署列表的旧部署“更多操作”中执行。

本地备份目录：`../backups/solar-system-atlas-20261004/`，包含旧版可发现公开资源、原响应头、部署信息、本地源码快照和 SHA-256 校验清单。备份不会上传到公开站点。

## 2026-10-04 优化版发布记录

- 正式网址：https://solar-system-atlas.pages.dev/
- 正式部署：`ff9d09d8-0c63-4a72-a92e-0f168b733337`，分支 `main`。
- 独立版本网址：https://ff9d09d8.solar-system-atlas.pages.dev/
- 验收预览：`3d70faf3-c3d5-48dd-9b35-28736f922e2f`，分支 `optimization-20261004`，https://3d70faf3.solar-system-atlas.pages.dev/ 。
- 先发布预览并核验地球档案玻璃背景；抽查原始地图图片、地理数据、云层数据与 Cesium 组件字节一致，再发布同一构建到正式站。
- 正式部署列表确认环境为 Production；正式网址入口、配置、地球代码和本地图片 SHA-256 与本地构建一致，卫星代理返回 HTTP 200 JPEG。正式页浏览器导航超时，未将其计作视觉验收；预览页已保存视觉截图。
- 截图：`qa/optimization-20261004/cloud-preview-earth.jpg`。

## 2026-10-04 手机修复版发布记录

- 正式部署：`060d723d-cdbb-4a86-a23a-8eb7c0e569bb`，环境 `Production`，分支 `main`。
- 正式网址不变：https://solar-system-atlas.pages.dev/ 。独立版本：https://060d723d.solar-system-atlas.pages.dev/ 。
- 上传 6 个变更静态文件，53 个复用文件；Worker、响应头和路由上传成功。
- 回滚版本：`ff9d09d8-0c63-4a72-a92e-0f168b733337`，https://ff9d09d8.solar-system-atlas.pages.dev/ ，未删除。
- 本地浏览器验收覆盖 320/375/390/430 像素宽度、844×390 横屏和 1440×900 桌面；详细范围、截图及真机限制见 `mobile-ui-20261004.md`。
- 正式网址的 `/assets/main.js`、地球入口 JS、`/assets/main.css`、`/solar/assets/solar.js`、`/solar/assets/solar.css` 均 HTTP 200 且 SHA-256 与验收构建一致。可使用 `node --dns-result-order=ipv4first qa/mobile-20261004/verify-production.mjs` 再次核验。
- 本机云端浏览器导航仍超时，没有将该页面计作线上视觉验收。

## 2026-10-05 统一界面发布记录

- 正式部署：`9cdd03e7-cd4f-4c0b-8d92-062ed44baf03`，环境 `Production`，分支 `main`。
- 正式网址不变：https://solar-system-atlas.pages.dev/ 。独立版本：https://9cdd03e7.solar-system-atlas.pages.dev/ 。
- 发布内容：本地 `dist-pages`（62 个文件，`npm run build:pages` 于 2026-10-05 02:32 生成），包含地球与太阳系统一界面、阅读面板章节选择器和档案版式调整。
- 同一构建的预览：`b28e56a0-11b6-4082-9c52-c32cf8b763c5`，分支 `ui-unification-20261005`，https://b28e56a0.solar-system-atlas.pages.dev/ ，未删除。
- 发布前本地 `npm run test:pages` 通过：Pages 适配器的固定源、缓存、方法与异常路径，以及打包瓦片的 JPEG 字节一致性、缩放级别与极区边缘。
- 发布后复核（HTTP 200，SHA-256 与本地构建一致）：`/`、`/assets/main.js`、`/assets/earth-entry-V6RD2VK3.js`、`/solar/`、`/solar/assets/solar.css`（171,690 字节）、`/solar/assets/solar.js`（1,955,446 字节）、`/planets/earth_daymap-4k.jpg`、`/data/earth-catalog.json`、`/audio/music/album.json`。其中打包资源由 `_worker.js` 从 `resourcepacks` 还原，字节与本地原始资源相同。
- 回滚版本：`060d723d-cdbb-4a86-a23a-8eb7c0e569bb`，https://060d723d.solar-system-atlas.pages.dev/ ，未删除。
- 本地视觉验收范围与限制见 `unified-earth-solar-ui-20261005.md`；桌面、390px 与 320px 截图位于 `qa/unified-ui-20261005/`。
