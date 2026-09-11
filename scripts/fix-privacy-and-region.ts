/**
 * 隐私与措辞清理（2026-09-11，按项目所有者要求）：
 *
 * 1. 删除「核验等级」相关措辞 —— 网友自述无法核实，也不应暗示需要核实；
 * 2. 删除评论者 IP 属地（`ip_location`）—— 平台显示属地不等于就诊地，且属于不必要的个人信息；
 * 3. 删除小红书用户名相关字段（`author_alias`）—— 不记录任何用户标识，连哈希也不留；
 * 4. 修 `hospital_region` 的「北京市北京市」这类省市重复拼接。
 *
 *   node scripts/fix-privacy-and-region.ts [--dry-run]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Report } from '../lib/schema.ts'
import { CURATED_FILES, RAW_DIR, readJson, today, writeJson } from './lib/paths.ts'

const dryRun = process.argv.includes('--dry-run')

/** 省市去重：直辖市/同名城市只保留一个 */
function tidyRegion(region?: string): string | undefined {
  if (!region) return undefined
  const text = region.trim()
  // 「北京市北京市」「上海市上海市」→「北京市」
  const dup = text.match(/^(.{2,10}?)\1$/)
  if (dup) return dup[1]
  // 「北京市北京」也归并
  const provinceThenShort = text.match(/^(.{2,8}(?:省|市|自治区))(.+)$/)
  if (provinceThenShort && provinceThenShort[1].startsWith(provinceThenShort[2])) return provinceThenShort[1]
  return text
}

const reportsFile = readJson<{ schema_version: string; updated_at: string; items: Report[] }>(
  CURATED_FILES.reports,
)

let removedAuthor = 0
let removedIp = 0
let fixedRegion = 0
let cleanedNotes = 0

for (const report of reportsFile.items as Array<Record<string, unknown>>) {
  if ('author_alias' in report) {
    delete report.author_alias
    removedAuthor += 1
  }
  if ('ip_location' in report) {
    delete report.ip_location
    removedIp += 1
  }

  const tidied = tidyRegion(report.hospital_region as string | undefined)
  if (tidied && tidied !== report.hospital_region) {
    report.hospital_region = tidied
    fixedRegion += 1
  }

  const verification = report.verification as { notes?: string } | undefined
  if (verification?.notes) {
    const cleaned = verification.notes
      .replace(/未经核实[、，]?/g, '')
      .replace(/未核实[、，]?/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    if (cleaned !== verification.notes) {
      verification.notes = cleaned
      cleanedNotes += 1
    }
  }
}

/* -------------------------------------------------- 原始抓取中的个人标识 */

const rawStripped: string[] = []
const commentsDir = resolve(RAW_DIR, 'comments')
if (existsSync(commentsDir)) {
  for (const name of readdirSync(commentsDir).filter((n) => n.endsWith('.json'))) {
    const path = resolve(commentsDir, name)
    const data = readJson<{ rows?: Array<Record<string, unknown>> }>(path)
    if (!Array.isArray(data.rows)) continue
    let changed = false
    for (const row of data.rows) {
      for (const key of ['author', 'info', 'parent_author', 'reply_to_author']) {
        if (key in row) {
          // info 形如「08-01广东」：只保留日期，丢掉 IP 属地
          if (key === 'info' && typeof row.info === 'string') {
            const date = row.info.match(/(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})/)?.[1]
            if (date) row.info = date
            else delete row.info
          } else {
            delete row[key]
          }
          changed = true
        }
      }
    }
    if (changed) {
      if (!dryRun) writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
      rawStripped.push(name)
    }
  }
}

const reportsRaw = resolve(RAW_DIR, 'reports.jsonl')
if (existsSync(reportsRaw)) {
  const lines = readFileSync(reportsRaw, 'utf8').split('\n').filter(Boolean)
  const rewritten = lines.map((line) => {
    try {
      const entry = JSON.parse(line) as { draft?: Record<string, unknown> }
      if (entry.draft) {
        delete entry.draft.author_nickname
        delete entry.draft.author_uid
      }
      return JSON.stringify(entry)
    } catch {
      return line
    }
  })
  if (!dryRun) writeFileSync(reportsRaw, `${rewritten.join('\n')}\n`, 'utf8')
  rawStripped.push('reports.jsonl')
}

console.log(`线索记录：删除用户名哈希 ${removedAuthor} 条、删除 IP 属地 ${removedIp} 条`)
console.log(`地区修正（省市重复）：${fixedRegion} 条`)
console.log(`措辞清理（去掉「未核实」字样）：${cleanedNotes} 条`)
console.log(`原始抓取清理个人标识：${rawStripped.join('、') || '（无）'}`)

if (dryRun) {
  console.log('\n（--dry-run，未写入）')
  process.exit(0)
}

reportsFile.updated_at = today()
writeJson(CURATED_FILES.reports, reportsFile)
console.log('\n✓ 已写回 reports.json')
