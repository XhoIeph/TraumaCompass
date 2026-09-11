/**
 * 上下文回填：用「带父评论信息」的评论抓取结果，补全评论来源线索的 evidence_context。
 *
 *   node scripts/collect/backfill-context.ts [--dry-run]
 *
 * 依赖 fetch-comments.ts 产出的 data/raw/comments/<note_id>.json，其中每行含：
 *   is_reply / parent_author / parent_excerpt / reply_to_author（由新版 extract-comments.js 捕获）
 *
 * 规则（见 docs/evidence-standards.md §2）：
 * - 有 note_title / parent_excerpt / is_reply 之一才算「有意义的上下文」；
 * - 补齐后清除 context_incomplete；仍缺的保持标记。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Report } from '../../lib/schema.ts'
import { CURATED_FILES, RAW_DIR, readJson, today, writeJson } from '../lib/paths.ts'

const dryRun = process.argv.includes('--dry-run')

type CommentRow = {
  author?: string
  info?: string
  text?: string
  is_reply?: boolean
  parent_author?: string
  parent_excerpt?: string
  reply_to_author?: string
}

type CommentFile = { note_id?: string; title?: string; url?: string; count?: number; rows?: CommentRow[] }

/** 名单截图归档（置顶评论里的图片，已逐字转写）—— 这类线索的"摘录"来自图片，不是评论文字 */
type EvidenceItem = {
  file: string
  source_post_id: string
  transcription: string
  contains: string
}

const COMMENTS_DIR = resolve(RAW_DIR, 'comments')
const MANIFEST = resolve(process.cwd(), 'data/evidence/manifest.json')

const NOTE_TITLES: Record<string, string> = {
  '69ede05b00000000350314ef': '建设cptsd/人格障碍/osdd/did全国就诊地图',
  '69f19ded0000000036003cb5': 'cptsd/人格障碍/osdd/did全国就诊线索1.0',
  '671efe3f000000001b03e2eb': 'BPD专业治疗：全国辨证行为疗法DBT医院名单',
  '69e7955a000000002200e48f': '北京回龙观医院创伤后应激障碍门诊开诊',
}

const evidenceItems: EvidenceItem[] = existsSync(MANIFEST)
  ? (readJson<{ items: EvidenceItem[] }>(MANIFEST).items ?? [])
  : []

const files: Array<{ name: string; data: CommentFile }> = existsSync(COMMENTS_DIR)
  ? readdirSync(COMMENTS_DIR)
      .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
      .map((name) => ({ name, data: readJson<CommentFile>(resolve(COMMENTS_DIR, name)) }))
  : []

// 第一轮用 page-eval 抓的评论区快照（较旧，无父评论字段，但能提供出处与所在帖）
const OPENCLI_DIR = resolve(RAW_DIR, 'opencli')
if (existsSync(OPENCLI_DIR)) {
  for (const name of readdirSync(OPENCLI_DIR).filter((n) => n.includes('page-page'))) {
    try {
      const raw = JSON.parse(readFileSync(resolve(OPENCLI_DIR, name), 'utf8')) as {
        data?: { url?: string; title?: string; rows?: CommentRow[] }
        url?: string
        title?: string
        rows?: CommentRow[]
      }
      // 两种形态都遇到过：{data:{rows}} 与顶层 {rows}
      const payload = raw.data ?? raw
      if (payload?.rows && payload.rows.length > 0) {
        const noteId = (payload.url ?? '').match(/\/(?:search_result|explore|discovery\/item)\/([0-9a-f]{24})/i)?.[1]
        files.push({
          name: `opencli/${name}`,
          data: {
            note_id: noteId,
            title: (noteId ? NOTE_TITLES[noteId] : undefined) ?? payload.title,
            rows: payload.rows,
          },
        })
      }
    } catch {
      /* 跳过无法解析的快照 */
    }
  }
}

if (files.length === 0) {
  console.error('data/raw/comments 下没有评论文件，请先运行 fetch-comments.ts')
  process.exit(2)
}

/** 归一化：去掉空白与标点，避免「刘斌，副主任医师」与「刘斌 副主任医师」这类差异造成漏匹配 */
const normalize = (value: string): string => value.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '')

/** 用逐级缩短的探针做匹配，容忍拼接、截断与「cptsd:」这类前缀差异 */
function probesOf(quote: string): string[] {
  const variants = [quote, quote.replace(/^[a-z\s\-/]+[:：]/i, ''), quote.replace(/^[\u4e00-\u9fa5]{2,8}[:：]/, '')]
  const probes = new Set<string>()
  for (const variant of variants) {
    const normalized = normalize(variant)
    for (const len of [24, 18, 14, 10, 8]) {
      const slice = normalized.slice(0, len)
      if (slice.length >= 6) probes.add(slice)
    }
  }
  return [...probes]
}

/**
 * 人工核对后的显式指派：这 4 条的摘录来自读图转写或早期快照，
 * 文本与任何自动匹配源都不逐字相同，故按人工核对结果固定出处（见 docs/evidence-standards.md）。
 */
const EVIDENCE_OVERRIDES: Record<
  string,
  { scope: string; noteTitle: string; isReply?: boolean }
> = {
  'xhs-436c5f135d': {
    scope: 'comments/opencli/2026-09-11T09-33-08-251Z-page-page.json（评论区文字）',
    noteTitle: '建设cptsd/人格障碍/osdd/did全国就诊地图',
    isReply: true,
  },
  'xhs-4caedbfb23': {
    scope:
      'data/evidence/xiaohongshu/69f19ded0000000036003cb5/review-gdph-houcailan.webp（评论区长文截图，人工核对）',
    noteTitle: 'cptsd/人格障碍/osdd/did全国就诊线索1.0',
    isReply: false,
  },
  'xhs-5892811db0': {
    scope:
      'data/evidence/xiaohongshu/69f19ded0000000036003cb5/profile-liubin-taikang.webp（挂号页截图，人工核对）',
    noteTitle: 'cptsd/人格障碍/osdd/did全国就诊线索1.0',
    isReply: false,
  },
  'xhs-ab437e8b9a': {
    scope:
      'data/evidence/xiaohongshu/69ede05b00000000350314ef/list-cptsd-head.webp（置顶评论名单截图，逐字转写）',
    noteTitle: '建设cptsd/人格障碍/osdd/did全国就诊地图',
    isReply: false,
  },
}

function findInComments(quote: string) {
  const probes = probesOf(quote)
  for (const file of files) {
    const rows = file.data.rows ?? []
    for (const probe of probes) {
      const index = rows.findIndex((row) => normalize(row.text ?? '').includes(probe))
      if (index >= 0) {
        return { file: file.name, row: rows[index], index, total: rows.length, title: file.data.title }
      }
    }
  }
  return null
}

function findInEvidence(quote: string): EvidenceItem | null {
  const probes = probesOf(quote)
  for (const item of evidenceItems) {
    if (!item.transcription) continue
    const haystack = normalize(item.transcription)
    if (probes.some((probe) => haystack.includes(probe))) return item
  }
  return null
}

const reportsFile = readJson<{ schema_version: string; updated_at: string; items: Report[] }>(
  CURATED_FILES.reports,
)

let filled = 0
let stillMissing = 0
let cleared = 0
let preserved = 0

for (const report of reportsFile.items) {
  if (report.evidence_source !== 'comment') continue

  // 只增不减：已有有意义上下文的记录一律不动，避免因原始文件被清空/刷新而"降级覆盖"
  const existing = report.evidence_context
  const alreadyMeaningful =
    !!existing &&
    (Boolean(existing.note_title) || Boolean(existing.parent_excerpt) || existing.is_reply !== undefined)
  if (alreadyMeaningful && report.context_incomplete !== true) {
    preserved += 1
    continue
  }

  const hit = findInComments(report.evidence_quote)

  // 评论文本里找不到 → 可能是「置顶评论名单截图」的逐字转写，改挂到归档证据上
  if (!hit) {
    const shot = findInEvidence(report.evidence_quote)
    if (shot) {
      report.evidence_context = {
        ...(report.evidence_context ?? {}),
        note_title: NOTE_TITLES[shot.source_post_id] ?? report.evidence_context?.note_title,
        is_reply: false,
        capture_scope: `data/evidence/${shot.file}（置顶评论名单截图，逐字转写）`,
      }
      report.context_incomplete = undefined
      filled += 1
      cleared += 1
      continue
    }

    // 最后兜底：人工核对过的显式指派
    const override = EVIDENCE_OVERRIDES[report.id]
    if (override) {
      report.evidence_context = {
        ...(report.evidence_context ?? {}),
        note_title: override.noteTitle,
        is_reply: override.isReply,
        capture_scope: override.scope,
      }
      report.context_incomplete = undefined
      filled += 1
      cleared += 1
      continue
    }
  }

  if (!hit) {
    if (report.context_incomplete !== true) {
      report.context_incomplete = true
    }
    stillMissing += 1
    continue
  }

  const { row } = hit
  const context = {
    ...(report.evidence_context ?? {}),
    note_title: report.evidence_context?.note_title ?? hit.title,
    index_in_capture: `第 ${hit.index + 1} 条 / 本次抓到 ${hit.total} 条`,
    capture_scope: `comments/${hit.file}`,
    ...(row.is_reply !== undefined ? { is_reply: row.is_reply } : {}),
    ...(row.parent_excerpt ? { parent_excerpt: row.parent_excerpt.slice(0, 300) } : {}),
    ...(row.parent_author || row.reply_to_author
      ? { parent_author: row.parent_author ?? row.reply_to_author }
      : {}),
  }
  report.evidence_context = context

  // 全文：原始评论若比摘录长，补进 evidence_full_text
  const full = (row.text ?? '').trim()
  if (full.length > report.evidence_quote.length && !report.evidence_full_text) {
    report.evidence_full_text = full.slice(0, 2000)
  }

  const meaningful =
    Boolean(context.note_title) || Boolean(context.parent_excerpt) || context.is_reply !== undefined
  if (meaningful) {
    filled += 1
    if (report.context_incomplete) {
      report.context_incomplete = undefined
      cleared += 1
    }
  } else {
    // 自动匹配到的"上下文"没有实质内容 → 再看人工指派
    const override = EVIDENCE_OVERRIDES[report.id]
    if (override) {
      report.evidence_context = {
        ...context,
        note_title: override.noteTitle,
        is_reply: override.isReply,
        capture_scope: override.scope,
      }
      report.context_incomplete = undefined
      filled += 1
      cleared += 1
    } else {
      report.context_incomplete = true
      stillMissing += 1
    }
  }
}

console.log(`评论文件：${files.map((f) => f.name).join('、')}`)
console.log(`保持不变（已有上下文）：${preserved} 条`)
console.log(`本次回填：${filled} 条（其中清除「上下文不完整」标记 ${cleared} 条）`)
console.log(`仍缺上下文：${stillMissing} 条`)

if (dryRun) {
  console.log('\n（--dry-run，未写入）')
  process.exit(0)
}

reportsFile.updated_at = today()
writeJson(CURATED_FILES.reports, reportsFile)
console.log('\n✓ 已写回 reports.json')
