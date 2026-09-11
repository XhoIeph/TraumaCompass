/**
 * 把一条采集结果规范化为公开数据。
 *
 *   node scripts/collect/record.ts --in draft.json [--dry-run]
 *
 * 草稿（draft.json）字段见 docs/collection-runbook.md；本脚本负责：
 *   1. 规范化链接（小红书去掉会过期的 xsec_token，只留 note_id 规范链接）
 *   2. 生成哈希别名与记录 id（真实昵称/uid 只写本地 raw，不进公开数据）
 *   3. 去重（同一条原帖只入库一次）
 *   4. 写入 data/curated/reports.json，并追加运行日志
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Report } from '../../lib/schema.ts'
import { aliasFor, loadSalt, recordIdFor } from '../../lib/hash.ts'
import { CURATED_FILES, RAW_DIR, RUNS_DIR, SECRETS_DIR, readJson, today, writeJson } from '../lib/paths.ts'

type Draft = {
  platform: Report['platform']
  source_url: string
  source_post_id?: string
  author_uid?: string
  author_nickname?: string
  published_at?: string
  published_at_precision?: Report['published_at_precision']
  ip_location?: string
  self_reported_region?: string
  hospital_region?: string
  hospital_id?: string
  hospital_name_raw?: string
  department?: string
  doctor_id?: string
  doctor_name_raw?: string
  doctor_title_raw?: string
  disorders: Report['disorders']
  stage?: Report['stage']
  diagnosis_claimed?: Report['diagnosis_claimed']
  experience?: number | null
  cost_cny?: { min?: number; max?: number }
  wait_days?: number
  evidence_quote: string
  evidence_source?: Report['evidence_source']
  verification_level?: Report['verification']['level']
  verification_notes?: string
  flags?: Partial<Report['flags']>
  run_id?: string
  tool?: string
}

const args = process.argv.slice(2)
const inIndex = args.indexOf('--in')
const dryRun = args.includes('--dry-run')

if (inIndex < 0) {
  console.error('用法：node scripts/collect/record.ts --in draft.json [--dry-run]')
  process.exit(2)
}

const draftPath = resolve(process.cwd(), args[inIndex + 1] ?? '')
if (!existsSync(draftPath)) {
  console.error(`找不到草稿文件：${draftPath}`)
  process.exit(2)
}

const draft = readJson<Draft>(draftPath)

/** 小红书：搜索结果链接带 xsec_token，会过期；展示与入库统一用规范链接 */
function canonicalUrl(platform: Draft['platform'], rawUrl: string): { canonical: string; postId?: string } {
  if (platform === 'xiaohongshu') {
    const match = rawUrl.match(/\/(?:search_result|explore|discovery\/item|note)\/([0-9a-f]{24})/i)
    if (match) {
      return { canonical: `https://www.xiaohongshu.com/explore/${match[1]}`, postId: match[1] }
    }
  }
  if (platform === 'zhihu') {
    const match = rawUrl.match(/zhihu\.com\/(?:question\/\d+\/answer\/\d+|p\/\d+)/i)
    if (match) {
      return { canonical: `https://www.${match[0].replace(/^zhihu\.com\//, 'zhihu.com/')}`, postId: match[0] }
    }
  }
  return { canonical: rawUrl }
}

const { canonical, postId } = canonicalUrl(draft.platform, draft.source_url)
const effectivePostId = draft.source_post_id ?? postId ?? canonical

const salt = loadSalt(SECRETS_DIR)
const aliasSeed = draft.author_uid ?? draft.author_nickname
if (!aliasSeed) {
  console.error('草稿缺少 author_uid / author_nickname —— 我们至少需要一个可哈希的原始标识（只用于哈希，不会入库）。')
  process.exit(2)
}

const alias = aliasFor(draft.platform, aliasSeed, salt)
const id = recordIdFor(draft.platform, effectivePostId)

const reportsFile = readJson<{ schema_version: string; updated_at: string; items: Report[] }>(
  CURATED_FILES.reports,
)
// 去重：同一个「证据点」只入库一次。同一条笔记的正文与不同评论可以各自成为独立线索，
// 因此按 id 判重；若 id 不同但来源链接与摘录都相同，视为重复抓取。
const duplicate = reportsFile.items.find(
  (item) =>
    item.id === id || (item.source_url === canonical && item.evidence_quote === draft.evidence_quote),
)

if (duplicate) {
  console.log(`↷ 已存在，跳过：${duplicate.id}（${duplicate.source_url}）`)
  process.exit(0)
}

const record: Report = {
  id,
  platform: draft.platform,
  source_channel: 'browser_session',
  source_url: canonical,
  source_post_id: effectivePostId,
  author_alias: alias,
  published_at: draft.published_at,
  published_at_precision: draft.published_at_precision ?? (draft.published_at ? 'day' : 'unknown'),
  ip_location: draft.ip_location,
  self_reported_region: draft.self_reported_region,
  hospital_region: draft.hospital_region,
  hospital_id: draft.hospital_id,
  hospital_name_raw: draft.hospital_name_raw,
  department: draft.department,
  doctor_id: draft.doctor_id,
  doctor_name_raw: draft.doctor_name_raw,
  doctor_title_raw: draft.doctor_title_raw,
  disorders: draft.disorders,
  stage: draft.stage ?? 'unknown',
  diagnosis_claimed: draft.diagnosis_claimed,
  experience: draft.experience ?? null,
  cost_cny: draft.cost_cny,
  wait_days: draft.wait_days,
  evidence_quote: draft.evidence_quote,
  evidence_source: draft.evidence_source ?? 'note_body',
  verification: {
    level: draft.verification_level ?? 'unverified',
    checked_by: 'agent',
    checked_at: today(),
    method: '人工核对原帖内容与字段',
    notes: draft.verification_notes,
  },
  extraction: {
    tool: draft.tool ?? 'record.ts',
    run_id: draft.run_id,
    captured_at: today(),
  },
  flags: {
    contains_minor: draft.flags?.contains_minor ?? false,
    contains_selfharm_detail: draft.flags?.contains_selfharm_detail ?? false,
    sensitive: draft.flags?.sensitive ?? false,
  },
  status:
    draft.flags?.contains_minor || draft.flags?.contains_selfharm_detail ? 'withheld' : 'published',
}

console.log('即将写入的记录：')
console.log(JSON.stringify(record, null, 2))

if (dryRun) {
  console.log('\n（--dry-run，未写入任何文件）')
  process.exit(0)
}

// 1) 原始采集留痕（含真实昵称/原始链接，只存本地）
mkdirSync(RAW_DIR, { recursive: true })
appendFileSync(
  resolve(RAW_DIR, 'reports.jsonl'),
  `${JSON.stringify({ recorded_at: new Date().toISOString(), draft, canonical })}\n`,
  'utf8',
)

// 2) 规范化记录入库
reportsFile.items.push(record)
reportsFile.items.sort((a, b) => a.id.localeCompare(b.id))
reportsFile.updated_at = today()
writeJson(CURATED_FILES.reports, reportsFile)

// 3) 运行日志
mkdirSync(RUNS_DIR, { recursive: true })
const runId = draft.run_id ?? `manual-${today()}`
const runFile = resolve(RUNS_DIR, `${runId}.json`)

type RunLog = {
  run_id: string
  started_at?: string
  entries: Array<Record<string, unknown>>
}

const run: RunLog = existsSync(runFile)
  ? readJson<RunLog>(runFile)
  : { run_id: runId, started_at: new Date().toISOString(), entries: [] }
run.entries.push({
  at: new Date().toISOString(),
  platform: record.platform,
  report_id: record.id,
  source_url: record.source_url,
  hospital_id: record.hospital_id,
  disorders: record.disorders,
})
writeJson(runFile, run)

console.log(`\n✓ 已写入 ${CURATED_FILES.reports}（当前 ${reportsFile.items.length} 条）`)
console.log(`✓ 原始留痕：${resolve(RAW_DIR, 'reports.jsonl')}（gitignored）`)
console.log(`✓ 运行日志：${runFile}`)
