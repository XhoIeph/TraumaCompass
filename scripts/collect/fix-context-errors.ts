/**
 * 上下文修复（2026-09-11）：
 *
 * A. 删除被误当成机构的占位条目，并解除线索对它们的关联；
 * B. 给所有「评论来源」的线索回填 evidence_full_text（原始评论往往超过 200 字，
 *    被截断会丢语义）与 evidence_context（这条评论是在哪、回复谁）；
 * C. 无法还原上下文的，显式标记 context_incomplete = true，供后续补抓。
 *
 *   node scripts/collect/fix-context-errors.ts [--dry-run]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Hospital, Report } from '../../lib/schema.ts'
import { CURATED_FILES, RAW_DIR, readJson, today, writeJson } from '../lib/paths.ts'

const dryRun = process.argv.includes('--dry-run')

/* ---------------------------------------------------------------- A. 占位机构 */

const PLACEHOLDER_HOSPITAL_IDS = new Set([
  'sd-jn-psy',
  'bj-first-tier',
  'cn-brain-hospital-unnamed',
  'bpd-dbt-alliance',
  'did-unnamed-doctor',
  'sd-sjsw',
])

/* ------------------------------------------- 已知的父评论（人工核对过线程） */

const KNOWN_PARENTS: Record<string, { parent_author?: string; parent_excerpt?: string; is_reply?: boolean }> = {
  'xhs-8d4f7eea3b': {
    parent_author: 'wowo',
    parent_excerpt: '宝你的cptsd诊断是怎么拿到的我感觉国内很难拿到这个',
    is_reply: true,
  },
  'xhs-425f6e2373': { is_reply: false },
  'xhs-c28fcd6daa': { is_reply: false },
  'xhs-374ed8d30d': { is_reply: false },
  'xhs-1ab485e324': { is_reply: false },
  'xhs-155c877b68': { is_reply: false },
  'xhs-f5822e0cef': { is_reply: false },
}

/* -------------------------------------------------------- 原始评论索引 */

type RawRow = { author?: string; info?: string; text?: string }
type RawSource = { file: string; noteTitle?: string; noteUrl?: string; rows: RawRow[] }

function collectRawSources(): RawSource[] {
  const sources: RawSource[] = []

  const commentsDir = resolve(RAW_DIR, 'comments')
  if (existsSync(commentsDir)) {
    for (const name of readdirSync(commentsDir).filter((n) => n.endsWith('.json') && !n.startsWith('_'))) {
      const data = readJson<{ title?: string; url?: string; rows?: RawRow[] }>(resolve(commentsDir, name))
      sources.push({ file: `comments/${name}`, noteTitle: data.title, noteUrl: data.url, rows: data.rows ?? [] })
    }
  }

  const opencliDir = resolve(RAW_DIR, 'opencli')
  if (existsSync(opencliDir)) {
    for (const name of readdirSync(opencliDir).filter((n) => n.includes('page-page'))) {
      try {
        const parsed = JSON.parse(readFileSync(resolve(opencliDir, name), 'utf8')) as {
          data?: { url?: string; rows?: RawRow[] }
        }
        const payload = parsed.data ?? (parsed as { rows?: RawRow[] })
        if (payload?.rows) {
          sources.push({
            file: `opencli/${name}`,
            noteUrl: (payload as { url?: string }).url,
            rows: payload.rows,
          })
        }
      } catch {
        /* 跳过无法解析的文件 */
      }
    }
  }

  return sources
}

function main() {
  const hospitalsFile = readJson<{ schema_version: string; updated_at: string; items: Hospital[] }>(
    CURATED_FILES.hospitals,
  )
  const reportsFile = readJson<{ schema_version: string; updated_at: string; items: Report[] }>(
    CURATED_FILES.reports,
  )

  // A. 删占位机构
  const before = hospitalsFile.items.length
  const removed = hospitalsFile.items.filter((h) => PLACEHOLDER_HOSPITAL_IDS.has(h.id))
  hospitalsFile.items = hospitalsFile.items.filter((h) => !PLACEHOLDER_HOSPITAL_IDS.has(h.id))

  let unlinked = 0
  for (const report of reportsFile.items) {
    if (report.hospital_id && PLACEHOLDER_HOSPITAL_IDS.has(report.hospital_id)) {
      report.hospital_id = undefined
      unlinked += 1
    }
    if (report.hospital_id && !hospitalsFile.items.some((h) => h.id === report.hospital_id)) {
      report.hospital_id = undefined
      unlinked += 1
    }
  }
  // 原文无地区线索的，清空臆测的地区字段
  const CLEAR_REGION = new Set(['xhs-8f5c1823a2', 'xhs-a2e3986fac', 'xhs-c0451d74b6', 'xhs-c3292f4c09'])
  for (const report of reportsFile.items) {
    if (CLEAR_REGION.has(report.id)) report.hospital_region = undefined
  }

  // B/C. 回填评论全文与上下文
  const sources = collectRawSources()
  let filledFullText = 0
  let filledContext = 0
  let markedIncomplete = 0

  for (const report of reportsFile.items) {
    if (report.evidence_source !== 'comment') continue

    const probe = report.evidence_quote.slice(0, 18)
    let matched: { source: RawSource; row: RawRow; index: number } | null = null
    for (const source of sources) {
      const index = source.rows.findIndex((row) => (row.text ?? '').includes(probe))
      if (index >= 0) {
        matched = { source, row: source.rows[index], index }
        break
      }
    }

    if (matched?.row.text) {
      const full = matched.row.text.trim()
      if (full.length > report.evidence_quote.length) {
        report.evidence_full_text = full.slice(0, 2000)
        filledFullText += 1
      }
      report.evidence_context = {
        note_title: matched.source.noteTitle,
        index_in_capture: `第 ${matched.index + 1} 条 / 共抓取 ${matched.source.rows.length} 条`,
        capture_scope: matched.source.file,
        ...(KNOWN_PARENTS[report.id] ?? {}),
      }
      filledContext += 1
    } else {
      report.context_incomplete = true
      report.evidence_context = { ...(KNOWN_PARENTS[report.id] ?? {}) }
      markedIncomplete += 1
    }

    const known = KNOWN_PARENTS[report.id]
    if (known?.parent_excerpt) {
      report.evidence_context = { ...report.evidence_context, ...known }
    }
  }

  console.log(`A. 机构：${before} → ${hospitalsFile.items.length}`)
  for (const h of removed) console.log(`   删除占位机构 ${h.id}（${h.name}）`)
  console.log(`   解除线索关联 ${unlinked} 条`)
  console.log(`B. 回填评论全文：${filledFullText} 条；回填上下文：${filledContext} 条`)
  console.log(`C. 无法还原上下文、已标记 context_incomplete：${markedIncomplete} 条`)

  if (dryRun) {
    console.log('\n（--dry-run，未写入）')
    return
  }

  hospitalsFile.updated_at = today()
  reportsFile.updated_at = today()
  writeJson(CURATED_FILES.hospitals, hospitalsFile)
  writeJson(CURATED_FILES.reports, reportsFile)
  console.log('\n✓ 已写回 hospitals.json 与 reports.json')
}

main()
