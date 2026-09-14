# TraumaCompass

**CPTSD / BPD 就诊资源与就诊线索地图（静态站点，项目早期版本）**

## 快速开始

```powershell
# 本机 PowerShell 禁止运行 npm.ps1，所有 npm 命令请走 cmd
cmd /c "npm install"

cmd /c "npm run geo:fetch"        # 下载省级底图（写入 public/geo/）
cmd /c "npm run provinces:build"  # 生成 data/curated/provinces.json

cmd /c "npm run data:validate"    # schema + 引用完整性 + 隐私红线
cmd /c "npm run data:build"       # 生成省级聚合
cmd /c "npm run dev"              # http://localhost:3000
```

### 底图 key（可选，但推荐）

首页是 Google Maps 式全页地图，底图用天地图瓦片（官方标准图源）：

1. 到 [console.tianditu.gov.cn](https://console.tianditu.gov.cn/api/key) 免费注册一个「浏览器端」类型的 key；
2. 本地开发：在项目根建 `.env.local`，写一行 `NEXT_PUBLIC_TIANDITU_KEY=你的key`；
3. 线上部署：在 GitHub 仓库添加 Actions secret `NEXT_PUBLIC_TIANDITU_KEY`（deploy workflow 已接入）。

**不配置 key 站点也不会挂**：地图自动回退为省界矢量示意底图（非标准地图），功能完全一致。

另需一个高德「Web 服务」类型 key（`AMAP_WEB_SERVICE_KEY`，同样放 `.env.local`），
供 `npm run geo:geocode` 在本地为新增机构做 POI 定点——它是服务端 key，**不要**加 `NEXT_PUBLIC_` 前缀。

生产构建（静态导出到 `out/`）：

```powershell
cmd /c "npm run build"
cmd /c "npm run serve"            # 本地预览 out/
```

## 目录结构

```
app/(map)/            首页：Google Maps 式全页地图（Leaflet + 天地图/矢量回退）
app/(site)/           常规内容页（医院 / 医生 / 线索 / 关于 / 投稿）
components/map/       地图应用组件（MapApp / Sidebar / 详情卡）
components/           列表与卡片组件（*Explorer / ReportCard）
lib/                  schema（zod）、数据装载、地区与格式化、哈希
data/curated/        公开数据：disorders / hospitals / doctors / reports / provinces
data/generated/      构建产物：province-stats.json
data/queries/        检索词库
data/runs/           采集运行日志（脱敏）
data/raw/            原始采集留痕（含真实昵称，gitignored）
scripts/             数据管线与采集工具（Node 24 原生运行 TS）
docs/                方法论 / 数据字典 / 合规 / 采集手册 / 撤下流程
public/geo/          省级边界（密度层与矢量回退底图用，示意性质）
```

## 数据管线

```
平台会话内检索 → data/raw/（本地留痕）
  → record.ts 归一化 + 哈希别名 + 去重 → data/curated/reports.json
  → validate-data.ts（zod + 引用完整性 + 隐私红线）
  → build-aggregates.ts → data/generated/province-stats.json
  → next build → out/ → GitHub Pages
```

常用脚本：

| 命令 | 作用 |
| --- | --- |
| `npm run data:validate` | 数据校验，`prebuild` 阶段自动运行，出错即阻断构建 |
| `npm run data:stats` | 数据体检：平台分布、核验等级、省级覆盖缺口 |
| `npm run audit:sources -- --write` | 原帖可达性巡检 |
| `npm run collect:sweep` | 全量扫词 → 发现新笔记（含签名链接）与待抓队列 |
| `npm run collect:fetch -- --limit 40` | 批量抓正文到 `data/raw/notes/`（不回显正文） |
| `npm run collect:triage` | 按医院/医生关键词分诊已抓正文 |
| `npm run collect:quota -- status` | 查看当日采集用量（仅统计，无上限） |
| `npm run collect:import -- --in x.json --kind search` | OpenCLI 输出 → 待补全草稿 |
| `npm run collect:record -- --in draft.json` | 草稿 → 公开数据（先加 `--dry-run` 检查） |
| `npm run geo:geocode` | 新增机构经高德 POI 自动定点（读 `.env.local` 的 `AMAP_WEB_SERVICE_KEY`，只处理仍为省级示意的机构；候选与判定规则留痕在 `data/runs/*-amap-geocode.json`） |

## 部署到 GitHub Pages

仓库已包含 `.github/workflows/deploy-pages.yml`：推送到 `main` 后自动构建并发布。

需要一次性手工设置：仓库 **Settings → Pages → Source 选择 “GitHub Actions”**。
站点地址：`https://<用户名>.github.io/TraumaCompass/`
（工作流会设置 `GITHUB_PAGES=true`，从而启用 `basePath` 与 `assetPrefix`。）

## 数据规范

字段定义、ID 与哈希规则、三个地区字段的区别、隐私红线，见 [docs/data-dictionary.md](docs/data-dictionary.md)
与 [docs/methodology.md](docs/methodology.md)。

## 许可

- 代码与数据结构：[Apache-2.0](LICENSE)
- 线索摘录：版权归原作者，本项目只做 ≤200 字的有限引用并附原帖链接，不转载全文、不镜像图片。
- 发现内容侵犯你的权利：请走 [撤下流程](docs/takedown.md)。
