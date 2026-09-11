# 采集运行手册（Runbook）

> 原则：**低频、可追溯、可停止**。宁可少收十条，也不要让账号被限制或让数据失去来源。

## 0. 一次性环境准备

```powershell
# 所有 npm/npx 命令都要经 cmd（本机 PowerShell 禁止运行 npm.ps1）
cmd /c "npm install"
```

### 0.1 知乎（Playwright + 登录态）

```powershell
# 在 dsh-web-search-pro 插件目录内运行，会打开可见浏览器窗口，扫码登录后回终端按回车
cmd /c "cd /d C:\Users\Lenovo\.dsh\profiles\web\node_modules\dsh-web-search-pro && node scripts\save-login.mjs zhihu D:\DeepseekHarness\cptsd_web\.secrets\zhihu-state.json"
```

然后在 dsh-browser 配置里声明命名 AuthProfile，并在 dsh-web-search-pro 的 `browserBindings` 中绑定：

```yaml
authProfiles:
  zhihu:
    storageStatePath: 'D:/DeepseekHarness/cptsd_web/.secrets/zhihu-state.json'
    allowedDomains: [zhihu.com, www.zhihu.com, zhuanlan.zhihu.com]
    persistState: true
```

### 0.2 小红书（OpenCLI Browser Bridge）

OpenCLI 分两半，两半都要在：

| 半边 | 是什么 | 怎么装 | 状态自查 |
| --- | --- | --- | --- |
| CLI / daemon | `@jackwener/opencli`，随 dsh-browser 插件安装，监听 `127.0.0.1:19825` | 插件自带，无需单独装 | `browser_opencli_status` 显示 `[OK] Daemon` |
| Browser Bridge 扩展 | 45KB 的 MV3 扩展，daemon 靠它操作浏览器 | 见下 | 同一命令显示 `[OK] Extension: connected` |

**浏览器侧（已在本机实测通过）**

1. 用日常浏览器打开 `edge://extensions`（本机只装了 Edge，Edge 实测可用）。
2. 从 [Chrome Web Store](https://chromewebstore.google.com/detail/opencli/ildkmabpimmkaediidaifkhjpohdnifk) 安装 OpenCLI 扩展；
   商店不可用时，从 [GitHub Releases](https://github.com/jackwener/opencli/releases) 下载 `opencli-extension-v{ver}.zip`，
   解压后「加载解压缩的扩展」。扩展只用到 `debugger / tabs / cookies / activeTab / alarms / storage / tabGroups / downloads`，
   没有 `minimum_chrome_version` 限制，因此 Edge 与 Chrome 都可运行。
3. 在该浏览器登录小红书（**建议用小号**）。
4. 注意冲突：开着 DevTools 或装了 1Password 这类抢占 CDP 的扩展时，`chrome.debugger` 可能 attach 失败。

**DSH 侧（容易被忽略，且与"装 OpenCLI"无关）**

`browser_opencli_run` 属于「general OpenCLI」，审批策略只由 `automationMode` 决定（`lib/approval-policy.js`）：

| automationMode | 通用 OpenCLI | 页面交互 | 页面脚本 / 上传 / 安装 |
| --- | --- | --- | --- |
| `standard`（默认） | 走审批 | 走审批 | 走审批 |
| `autonomous` | **仍走审批** | 直通 | 仍走审批 |
| `unrestricted` | 直通 | 直通 | 直通 |

因此采集需要 `unrestricted`。**保存后必须重启 profile 才生效**（运行中的进程在启动时读取配置）；
若本会话的审批提示被禁用，未重启前所有"走审批"的调用都会被自动拒绝。


## 1. 每轮采集的固定流程

### 1.1 实测结论（2026-09-11 首次采集）

站内适配器目前有**列表截断**问题，实测对策如下：

| 目标 | 站内适配器 | 实测对策 |
| --- | --- | --- |
| 搜索列表 | `xiaohongshu search` 只回 **1 条** | 用 `collect:run page --url "<搜索页>" --js-file tmp/extract-search.js` → **20 条，全部带签名** |
| 笔记正文 | `xiaohongshu note` 正常（返回 `{field,value}` 键值对） | 直接可用，但**必须传带 `xsec_token` 的签名 URL**，`/explore/<id>` 会被拒绝（`ARGUMENT`）|
| 笔记评论 | `xiaohongshu comments` 只回 **1 条** | 用 `collect:run page --url "<签名笔记链接>" --js-file tmp/extract-comments.js` |

要点：

- **签名 URL 只在搜索页 DOM 的 `a.cover.mask` 上**，普通 `/explore/` 链接不带 token —— 抽取脚本必须优先取它。
- 评论里经常直接出现医院名与医生名（例："去郑大一附院看就OK了""我当年在重庆附一医院诊治的"），
  且评论行自带**作者、时间与 IP 属地**，是「具体评价」的主要来源。
- `note` 返回的笔记没有发布时间字段，用 **note_id 前 8 位十六进制**（ObjectID 时间戳）推导，
  `published_at_precision` 记 `derived`。
- 一条笔记可以产出**多条线索**（正文一条 + 不同评论各一条）：
  `source_post_id` 加 `#c-<标识>` 区分，`record.ts` 按 id 判重，不再按来源链接整体判重。

### 1.2 截图证据（重要：名单常在图片里）

这两条汇总帖的完整名单其实**是截图**，正文只写了一部分。处理方式：

1. **找图**：`collect:run page --url "<签名笔记链接>" --js-file tmp/scan-page-images-deep.js --kind search`
   —— 该脚本会展开折叠回复、把整个评论区滚到底，再收集所有 CDN 图片（`inComment` 标记区分正文图与评论图）。
2. **下图**：用返回的 `src` 直接 `curl` 下载。注意小红书返回的是 **WebP**（即使文件名像 jpg），
   扩展名要写 `.webp`，否则读图工具会因格式不符拒绝。
3. **读图转写**：本模型支持图像输入，**直接读图即可，不需要 OCR 依赖**。
   逐张转写为「医院 + 医生 + 标注（书面/口头/触发风险/进修中）」的结构化条目。
4. **归档**：图片放进 `data/evidence/<platform>/<post-id>/`，在 `data/evidence/descriptions.json`
   写明 `contains` 与逐字 `transcription`，然后跑
   `node scripts/collect/build-evidence-manifest.ts` 生成带 SHA-256 与出处的 `manifest.json`。
   仓库里必须能追溯「这句话是从哪张图来的」，因为原帖和图片链接都可能失效。

### 1.3 命令序列

```powershell
# 1) 看今日还剩多少额度（每次调用会自动 check + consume）
node scripts/collect/quota.ts status

# 2) 取整页搜索结果（含签名链接），1 次 search 配额
node scripts/collect/run-opencli.ts page --url "https://www.xiaohongshu.com/search_result?keyword=CPTSD%20%E5%8C%BB%E9%99%A2%20%E8%AF%8A%E6%96%AD" --js-file tmp/extract-search.js

# 3) 挑出目标笔记 → 取正文（1 次 note 配额）
node scripts/collect/run-opencli.ts note "<从原始文件里取的签名 URL>"

# 4) 取评论（1 次 comments 配额）
node scripts/collect/run-opencli.ts page --url "<签名 URL>" --js-file tmp/extract-comments.js --kind comments

# 5) 人工判断医院/医生/疾病/阶段 → 写 draft.json
# 6) 入库（先干跑）
node scripts/collect/record.ts --in tmp/drafts/d1.json --dry-run
node scripts/collect/record.ts --in tmp/drafts/d1.json

# 7) 校验与聚合
node scripts/validate-data.ts && node scripts/build-aggregates.ts && node scripts/data-stats.ts
```

原始 JSON 全部落在 `data/raw/opencli/`（gitignored），脚本只回显精简摘要，避免污染对话上下文。

### 1.3 旧命令（保留兼容）

```powershell
cmd /c "npm run collect:quota -- status"
cmd /c "npm run collect:import -- --in tmp/xhs-search.json --kind search --run 2026-09-11-xhs-1"
```


## 2. 草稿（draft.json）字段

必填：`platform`、`source_url`、`evidence_quote`、`disorders`、`author_uid`（或 `author_nickname`，仅用于哈希）。

常用可选字段：`source_post_id`、`published_at`、`published_at_precision`、`ip_location`、
`self_reported_region`、`hospital_region`、`hospital_id`、`hospital_name_raw`、`department`、
`doctor_name_raw`、`doctor_title_raw`、`stage`、`experience`、`cost_cny`、`wait_days`、
`evidence_source`、`verification_level`、`flags`、`run_id`、`tool`。

```json
{
  "platform": "xiaohongshu",
  "source_url": "https://www.xiaohongshu.com/search_result/65f0c1a2000000000e01abcd?xsec_token=...",
  "author_nickname": "（原帖昵称，只会被哈希）",
  "published_at": "2025-03-14",
  "published_at_precision": "day",
  "ip_location": "四川",
  "hospital_id": "wcsh-mental-health",
  "hospital_name_raw": "华西心理卫生中心",
  "department": "心理卫生中心",
  "disorders": ["cptsd"],
  "stage": "diagnosed",
  "evidence_quote": "在华西挂了心理卫生中心，医生问得很细，最后病历上写的是创伤后应激障碍，没写 CPTSD。",
  "evidence_source": "note_body",
  "verification_level": "unverified",
  "run_id": "2026-09-11-xhs-1"
}
```

`record.ts` 会自动：规范化链接（小红书去掉 `xsec_token`）、生成 `xhs-xxxxxxxxxx` 记录 id、
把昵称哈斯化为 `xhs-xxxxxxxx`、按链接/id 去重、写 raw 留痕与运行日志。

## 3. 硬性纪律

- **无数量上限**（2026-09-11 起取消所有自设配额，`collect:quota` 只做用量统计）。
  停止信号只有两个：① 平台出现登录墙/验证码/限流；② 连续多轮检索不再产出高相关度新内容（饱和）。
- **节奏**：保持人类尺度（命令之间自然间隔、单线程、单标签页）；规模大时用小号。
- **不做**：批量抓私信/非公开内容、换 IP 或换 UA 绕过限制、并发压站。
- **熔断**：出现登录墙（`登录后查看搜索结果`）、验证码、限流页、连续 2 次异常返回 → 立即停止本轮并记录，
  **不换 IP、不换 UA、不重试绕过**。

## 4. 故障兜底链（小红书）

1. Edge + OpenCLI 扩展（首选）。
2. Chrome + OpenCLI 扩展。
3. Playwright/Patchright + storageState 读搜索页（有界、低频，接受更高风控风险）。
4. 人工辅助：人工检索后把链接/摘录粘贴给我，用 `record.ts` 归一化入库 —— **字段标准不降**。

## 5. 采集后自检

```powershell
cmd /c "npm run data:validate"   # schema + 引用完整性 + 隐私红线
cmd /c "npm run data:build"      # 重新聚合
cmd /c "npm run data:stats"      # 看平台分布、核验等级、省级覆盖缺口
cmd /c "npm run audit:sources -- --write"   # 原帖可达性巡检
```
