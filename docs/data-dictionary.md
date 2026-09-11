# 数据字典

所有公开数据位于 `data/curated/`，每个文件都是 `{ schema_version, updated_at, items: [] }` 结构，
由 `lib/schema.ts`（zod）在 `npm run data:validate` 阶段强制校验；聚合产物写入 `data/generated/`。

```
data/
├─ curated/          公开数据（进仓库、进站点）
│  ├─ disorders.json 疾病条目（ICD-11 / ICD-10 对照）
│  ├─ hospitals.json 机构
│  ├─ doctors.json   医生（只依据公开执业信息）
│  ├─ reports.json   就诊线索（脱敏）
│  └─ provinces.json 省级行政区（由底图生成，勿手改）
├─ generated/        构建产物
│  ├─ province-stats.json 省级聚合（地图消费）
│  └─ source-audit.json   来源巡检结果（--write 时生成）
├─ queries/queries.json 检索词库
├─ runs/<run_id>.json   采集运行日志（已脱敏）
└─ raw/                 原始采集留痕（含真实昵称，**gitignored**）
```

## Report（就诊线索）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `平台前缀-10位哈希`，由 `platform + post_id` 生成 |
| `platform` | enum | `xiaohongshu` / `zhihu` / `weibo` / `douban` / `tieba` / `web` / `other` |
| `source_channel` | enum | `browser_session`（会话内读取）/ `public_web` / `manual` |
| `source_url` | url | **规范化链接**（小红书去掉 xsec_token，用 `/explore/<note_id>`） |
| `source_post_id` | string? | 平台内 id（小红书 note_id / 知乎 answer id） |
| `author_alias` | string | `sha256(SALT + platform + uid)` 前 8 位，形如 `xhs-1a2b3c4d`；**禁止真实昵称** |
| `published_at` | date? | 发表时间（YYYY-MM-DD） |
| `published_at_precision` | enum | `exact` / `day` / `month` / `year` / `derived`（由 note_id 推导）/ `unknown` |
| `ip_location` | string? | 平台显示的 IP 属地（≠ 居住地） |
| `self_reported_region` | string? | 作者自述所在地 |
| `hospital_region` | string? | 医院所在地区 |
| `hospital_id` / `hospital_name_raw` | string? | 关联机构 id / 原文写法 |
| `department` | string? | 科室 |
| `doctor_id` / `doctor_name_raw` / `doctor_title_raw` | string? | 医生关联与原文写法 |
| `disorders` | enum[] | `cptsd` / `bpd` / `osdd` / `did` / `ptsd` / `other` |
| `stage` | enum | `seeking` 求医中 / `consulted` 已就诊 / `assessed` 已评估 / `diagnosed` 自称已确诊 / `treated` 已治疗 / `unknown` |
| `diagnosis_claimed` | object? | `{ code_raw, basis, confidence }`：原文提到的编码、依据（病历/诊断书/口头）、置信度 |
| `experience` | 1–5 \| null | 主观体验评分（仅当我们能从原文明确判断时才填） |
| `cost_cny` | `{min?,max?}`? | 费用自述 |
| `wait_days` | number? | 等待天数 |
| `evidence_quote` | string | **逐字摘录 ≤200 字**，必填 |
| `evidence_source` | enum | `note_body` / `comment` / `answer` / `article` / `other` |
| `verification` | object | `{ level, checked_by, checked_at, method, notes }` |
| `extraction` | object | `{ tool, run_id, captured_at }` 采集溯源 |
| `flags` | object | `contains_minor` / `contains_selfharm_detail` / `sensitive` |
| `status` | enum | `published` / `withheld`（保留编号、内容下线）/ `removed` |

**硬性规则**（`npm run data:validate` 会失败）：
- 已发布（`published`）必须有 `source_url` 与 `evidence_quote`。
- `contains_minor` 或 `contains_selfharm_detail` 为真时，`status` 不得为 `published`。
- `author_alias` 必须符合哈希别名格式（防止误把真实昵称写进公开数据）。

## Hospital（机构）

| 字段 | 说明 |
| --- | --- |
| `id` | 小写字母/数字/连字符 |
| `name` / `aliases` | 全称与常见简称（「北医六院」这类简称对检索很重要） |
| `adcode` | 省级行政区划代码（GB/T 2260），必须存在于 `provinces.json` |
| `province` / `city` | 省 / 市 |
| `level` | 三级甲等 / 三级乙等 / … / 未知 |
| `category` | 精神专科 / 综合医院心理科 / 综合医院精神科 / 民营 / 其他 |
| `departments` | 科室列表 |
| `trauma_service` | `cptsd_assessment` / `cptsd_bpd_diagnosis` / `icd11_practice`：`yes` 官方页面明确说明提供该项服务 / `claimed` **有间接证据**（创伤治疗项目、指南参编、培训体系、网友线索等，但未明确说明提供该项服务）/ `unknown` 未知 / `no` 无；`evidence[]` 为逐条证据说明，须写明来源与时间 |
| `address` / `website` / `phone_public` | 公开信息 |
| `coordinates` | 首版地图不打点，未核实时必须为 `null` |
| `official_sources` | 官方来源 URL（医院官网 / 卫健委） |
| `last_verified_at` | 最近核实日期 |

## Doctor（医生）

只收录公开执业信息：`name` / `hospital_id` / `department` / `title` / `credentials` / `profile_urls` / `specialties` / `official_sources` / `last_verified_at`。
网友评价不作为医生条目的字段，只以线索形式存在并按 `doctor_id` 关联。

## Disorder（疾病条目）

`id` / `name_zh` / `name_en` / `icd11_code` / `icd10_equivalent`（`null` 表示 ICD-10 无对应类目）/ `icd11_only` /
`summary` / `diagnostic_notes` / `visible`（是否在首期上线）/ `code_review_status`（`verified` 已在 WHO ICD-11 浏览器核对 / `pending_review`）/ `sources`。

## Province（省级行政区）

`adcode` / `name` / `short_name` / `region`（华北/东北/华东/华中/华南/西南/西北/港澳台）/ `geojson_name`。
由 `npm run provinces:build` 从 `public/geo/china-provinces.json` 生成，**不要手工编辑**。

## 聚合产物

`province-stats.json`：`totals`（线索总数、未定位数、机构数、医生数、覆盖省份数）+ 每省
`reports_total` / `reports_by_disorder` / `reports_by_platform` / `hospitals_total` /
`hospitals_with_service_evidence` / `doctors_total` / `verification` 分布。

## 采集相关文件（不进公开数据）

| 路径 | 内容 | 是否进仓库 |
| --- | --- | --- |
| `data/raw/reports.jsonl` | 原始草稿留痕（含真实昵称、原始带 token 链接） | 否（gitignored） |
| `data/raw/drafts/*.json` | OpenCLI 导入的待补全草稿 | 否 |
| `data/runs/<run_id>.json` | 采集运行日志（只有 id/平台/链接/疾病，已脱敏） | 是 |
| `.secrets/salt.txt` | 哈希盐 | 否 |
| `.secrets/quota.json` | 每日配额计数 | 否 |
| `.secrets/zhihu-state.json` | 知乎登录态 | 否 |
