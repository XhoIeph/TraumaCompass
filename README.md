# TraumaCompass

**CPTSD / BPD 就诊资源与就诊线索地图（静态站点，项目早期版本）**

ICD-11 把「复杂性创伤后应激障碍（CPTSD，6B41）」列为独立诊断，ICD-10 体系中没有对应类目，
而国内临床诊断书写与医保结算长期以 ICD-10 及医保版编码为主。结果是：符合描述的人往往拿不到这个诊断。

本项目用一张全国地图同时呈现两件事：

- **可及资源**：有官方来源或明确证据支撑的创伤相关服务机构（创伤治疗项目、专科门诊、培训体系、
  专业指南参编等，证据强度逐条记录，不等于该机构一定能开出 CPTSD 诊断）；
- **就诊线索**：网友在公开平台留下的真实就诊路径（医院、科室、医生、流程、费用、体验），
  逐条脱敏、附原帖链接、标注核验等级。

> ⚠️ 本站不是医疗机构，不提供诊断或治疗建议。线索均为公开自述摘录，未经核实。
> 危机中请拨打全国统一心理援助热线 **12356**。

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

生产构建（静态导出到 `out/`）：

```powershell
cmd /c "npm run build"
cmd /c "npm run serve"            # 本地预览 out/
```

## 目录结构

```
app/                 Next.js App Router 页面（地图 / 医院 / 医生 / 线索 / 关于 / 投稿）
components/          地图与列表组件（ChinaMap / *Explorer / ReportCard）
lib/                 schema（zod）、数据装载、地区与格式化、哈希
data/curated/        公开数据：disorders / hospitals / doctors / reports / provinces
data/generated/      构建产物：province-stats.json
data/queries/        检索词库
data/runs/           采集运行日志（脱敏）
data/raw/            原始采集留痕（含真实昵称，gitignored）
scripts/             数据管线与采集工具（Node 24 原生运行 TS）
docs/                方法论 / 数据字典 / 合规 / 采集手册 / 撤下流程
public/geo/          省级底图（示意性质，非标准地图）
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

## 采集纪律

- **不设数量上限**（`collect:quota` 只统计用量）。停止条件：① 平台出现登录墙/验证码/限流；
  ② 连续多轮检索不再产出高相关度新内容（饱和）。
- 只读公开内容；通过已登录的真实浏览器会话进行，**不逆向接口、不复现签名、不绕验证码**。
- 节奏保持人类尺度（单线程、单标签页）；规模大时建议用小号。
- 详见 [docs/collection-runbook.md](docs/collection-runbook.md) 与 [docs/compliance.md](docs/compliance.md)。

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
