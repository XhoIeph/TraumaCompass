/**
 * 来源可达性巡检：检查已发布线索的原帖链接是否仍然可访问。
 * 失效线索应在 data/curated/reports.json 中改为 status=withheld（保留 id、下线内容）。
 *
 * 用法：node scripts/audit-sources.ts [--limit 40] [--write]
 */
import type { Report } from '../lib/schema.ts'
import { CURATED_FILES, GENERATED_DIR, readJson, writeJson } from './lib/paths.ts'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const limitArg = args.indexOf('--limit')
const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : 40
const shouldWrite = args.includes('--write')

const reports = readJson<{ items: Report[] }>(CURATED_FILES.reports).items.filter(
  (report) => report.status === 'published',
)

const targets = reports.slice(0, Number.isFinite(limit) && limit > 0 ? limit : 40)
const results: Array<{ id: string; url: string; status: number | null; ok: boolean; note?: string }> = []

async function probe(report: Report) {
  try {
    const response = await fetch(report.source_url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'TraumaCompass-link-check/0.1 (+https://github.com/XhoIeph/TraumaCompass)' },
    })
    const ok = response.status >= 200 && response.status < 400
    results.push({ id: report.id, url: report.source_url, status: response.status, ok })
  } catch (error) {
    results.push({
      id: report.id,
      url: report.source_url,
      status: null,
      ok: false,
      note: error instanceof Error ? error.message : String(error),
    })
  }
}

const queue = [...targets]
const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
  while (queue.length > 0) {
    const next = queue.shift()
    if (!next) break
    await probe(next)
  }
})
await Promise.all(workers)

results.sort((a, b) => a.id.localeCompare(b.id))
const failed = results.filter((result) => !result.ok)

console.log(`巡检 ${results.length} 条已发布线索，正常 ${results.length - failed.length}，异常 ${failed.length}`)
for (const item of failed) {
  console.log(`  ✗ ${item.id} ${item.status ?? 'ERR'} ${item.url}${item.note ? ` — ${item.note}` : ''}`)
}

const output = {
  schema_version: '1.0.0',
  checked_at: new Date().toISOString(),
  checked: results.length,
  failed: failed.length,
  results,
}

if (shouldWrite) {
  writeJson(resolve(GENERATED_DIR, 'source-audit.json'), output)
  console.log(`✓ 已写入 ${resolve(GENERATED_DIR, 'source-audit.json')}`)
} else {
  console.log('（加 --write 可把结果写入 data/generated/source-audit.json）')
}
