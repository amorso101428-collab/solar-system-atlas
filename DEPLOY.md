# 部署到 Cloudflare Pages（space.cwwu.cc）

站点是**纯静态**产物（`npm run build` → `dist/`），没有服务端、没有密钥。

## 0. 当前状态（2026-09-21）

| 项目 | 值 |
| --- | --- |
| Cloudflare 账号 | `amorso101428@gmail.com`（`6ecae33cc6a6cd0f902b2e356286ad5d`） |
| Pages 项目 | `solar-system-atlas` |
| 预览/默认域名 | https://solar-system-atlas.pages.dev （已上线，验证通过） |
| 自定义域 | `space.cwwu.cc`（已绑定，状态 pending：**等 Namecheap 上的 CNAME**） |
| 线上产物 | 143 个文件 / 32 MB，`_headers` 生效 |

上线后用 `tools/live-probe.ps1` 复验（无头 Chrome 直连线上地址，带 CSP 违规收集）：

```powershell
pwsh -File .\tools\live-probe.ps1 -Url 'https://solar-system-atlas.pages.dev/' -ErrProbe -ShotName 'live-home.png'
```

## 1. 本地构建

```powershell
cd C:\Users\Lenovo\Documents\ChatGPT\交互网页设计\solar-system-atlas
npm run build
```

输出的 `dist/`：144 个文件、约 32 MB、单文件最大 2.45 MB（Pages 限制是 20,000 文件 / 单文件 25 MiB）。

## 2. 部署（二选一）

**A. 命令行（已登录 wrangler）**

```powershell
npx wrangler pages deploy dist --project-name=solar-system-atlas --branch=main --commit-dirty=true
```

也可以直接用项目里的脚本：`npm run deploy:pages`（构建 + 上传一步到位）。

> 注：`wrangler pages project create` 在 wrangler 4.135 上会被委派到 Workers 并失败，
> 需要加 `--force` 才能走老 Pages 通道；项目已建好，**以后部署不用再带 --force**。

**B. 浏览器面板**：Workers & Pages → 创建 → Pages → 上传资产 → 把整个 `dist` 目录拖进去。

## 3. 绑定自定义域名 space.cwwu.cc

`cwwu.cc` 的 DNS 在 Namecheap（不在 Cloudflare 账号里），所以有两种接法：

**方式一（最省事）：Namecheap 加一条 CNAME**

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| CNAME | `space` | `solar-system-atlas.pages.dev` | Automatic |

然后在 Pages 项目 → 自定义域 → 添加 `space.cwwu.cc`，等证书签发（几分钟）。

**方式二（想用 Cloudflare 的 WAF/缓存规则）：把 `space.cwwu.cc` 作为独立 zone 加进 Cloudflare**

和现有的 `esselano.ccwu.cc` 一样做 NS 委派：Cloudflare 会给一对 NS（形如 `xxx.ns.cloudflare.com`），
到 Namecheap 给 `space` 子域加这两条 NS 记录，等 zone 激活后把 `space.cwwu.cc` 绑到 Pages 项目。

## 4. 上线后核对

- `https://space.cwwu.cc/` 能打开，控制台无报错
- 响应头里有 `content-security-policy` / `x-content-type-options`（来自 `public/_headers`）
- 打开音乐厅，曲目能播（默认走网易云外链）
- 播放时地址栏的小锁仍在（音频跳转到 `*.music.126.net` 的 https）

## 音乐说明

默认播放源是网易云音乐官方外链：`https://music.163.com/song/media/outer/url?id=<歌曲ID>.mp3`，
302 到唱片公司 CDN 的 mp3，站点里**不打包任何音频文件**。14 首曲目 ID 写在
`public/audio/music/album.json` 的 `netease` 字段里。

另有两个备选源：Bandcamp 官方流（URL 带时效 token，过期会跳到下一首）和用户自选文件/直链。

版权：专辑标注 CC BY-NC-SA（署名-非商业-相同方式共享），**不能用于商业站点**；
网易云外链属于其外链播放器接口，正式商用前需自行确认授权。

## 已知的小约束

站点里 `/data/...`、`/fonts/...` 这类路径是**根绝对路径**，所以只能部署在域名根目录
（`space.cwwu.cc/` 可以，`space.cwwu.cc/xxx/` 不行）。
