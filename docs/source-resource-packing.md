# 源码仓库的资源整合

1,498 个原始瓦片、图片和静态资源已无损合成为 12 个文件（11 个不超过 16 MiB 的二进制资源包及 1 个索引）。原始资源共 229,822,616 字节，包内去重和 gzip 后为 179,614,327 字节；未降分辨率或重新编码图片。

`source-assets/manifest.json` 保存每个原文件的路径、长度和 SHA-256，以及每个资源包的校验值。还原前先验证资源包，解压后再验证每个文件。已在空的 QA 子目录中还原全部 1,498 个文件，逐项校验通过。

`npm ci` 的 postinstall 自动还原。构建和测试同样自动补齐资源，因此检出新工程后可以按 README 重建完整网站。手动运行 `npm run prepare:assets` 还原，`npm run verify:assets` 只做校验。

本机的原始 `public/`、`integrations/solar-system-atlas/public/` 和 `assets/sources/` 保留为可编辑工作文件，但不再逐个提交到 Git。修改素材后运行 `npm run pack:assets`，再提交更新的 `source-assets/`；还原工具发现本地不同版本时会保留该文件并提示重新打包。

源码资源包与云端运行包用途不同：前者用于 GitHub 工程重建，后者保持网站现有 URL、边缘读取与缓存，发布目录仍为 62 个文件。旧版提交历史保留，因此 Git 历史的总体下载体积不会因为当前目录精简而自动消失。
