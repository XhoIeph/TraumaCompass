/**
 * 全面扫词：把检索词库逐条跑一遍，抽取搜索结果页的完整列表，
 * 与历史状态去重，输出「本轮新增了哪些笔记」以及待抓取队列。
 *
 *   node scripts/collect/sweep.ts [--max-queries 20] [--bucket diagnosis-path] [--session tc]
 *
 * 产物（均在 gitignored 的 data/raw/sweep/ 下）：
 *   state.json    历史见过的笔记（note_id → 首次命中的检索词、标题、作者、点赞、时间）
 *   pending.json  已发现但尚未抓正文的笔记队列（含签名 URL）
 *   <date>-rows.jsonl  本轮全部命中行
 *
 * 注意：签名 URL（xsec_token）会过期，pending 队列里的链接应当尽快用 fetch-notes.ts 消费。
 */
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { QUERIES_FILE, RAW_DIR, readJson, writeJson } from '../lib/paths.ts'
import { consumeQuota } from './quota-lib.ts'

const OPENCLI_ENTRY =
  process.env.OPENCLI_ENTRY ??
  'C:\\Users\\Lenovo\\.dsh\\profiles\\web\\node_modules\\@jackwener\\opencli\\dist\\src\\main.js'

const args = process.argv.slice(2)
const take = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

const session = take('--session') ?? 'tc'
const maxQueries = Number(take('--max-queries') ?? '999')
const onlyBucket = take('--bucket')

type QueryFile = {
  buckets: Array<{ id: string; label: string; queries: string[] }>
}

const queriesFile = readJson<QueryFile>(QUERIES_FILE)
const queries = queriesFile.buckets
  .filter((bucket) => !onlyBucket || bucket.id === onlyBucket)
  .flatMap((bucket) => bucket.queries.map((query) => ({ query, bucket: bucket.id })))
  .slice(0, maxQueries)

const SWEEP_DIR = resolve(RAW_DIR, 'sweep')
mkdirSync(SWEEP_DIR, { recursive: true })
const STATE_FILE = resolve(SWEEP_DIR, 'state.json')
const PENDING_FILE = resolve(SWEEP_DIR, 'pending.json')
const EXTRACT_JS = resolve(process.cwd(), 'scripts/collect/js/extract-search.js')

type Row = { note_id: string; url: string; title: string; author: string; likes: string; signed: boolean }
type StateEntry = { firstQuery: string; bucket: string; title: string; author: string; likes: string; url: string; seenAt: string }

const state: Record<string, StateEntry> = existsSync(STATE_FILE)
  ? readJson<Record<string, StateEntry>>(STATE_FILE)
  : {}
const pending: Record<string, StateEntry & { note_id: string }> = existsSync(PENDING_FILE)
  ? readJson<Record<string, StateEntry & { note_id: string }>>(PENDING_FILE)
  : {}

const js = readFileSync(EXTRACT_JS, 'utf8')
const evalTarget = resolve(SWEEP_DIR, `_last-eval.json`)

function runCli(cliArgs: string[], target: string): boolean {
  const fd = openSync(target, 'w')
  const result = spawnSync(process.execPath, [OPENCLI_ENTRY, ...cliArgs], {
    stdio: ['ignore', fd, 'inherit'],
    windowsHide: true,
  })
  closeSync(fd)
  return result.status === 0
}

function readEval(): Row[] {
  try {
    const parsed = JSON.parse(readFileSync(evalTarget, 'utf8')) as unknown
    const payload = parsed && typeof parsed === 'object' && 'data' in (parsed as object)
      ? (parsed as { data: unknown }).data
      : parsed
    const rows = (payload as { rows?: Row[] })?.rows
    return Array.isArray(rows) ? rows.filter((row) => row.note_id) : []
  } catch {
    return []
  }
}

const relevant = (title: string): boolean =>
  /cptsd|ptsd|创伤|人格障碍|bpd|边缘|解离|osdd|did|多重人格|就诊|确诊|医院|门诊|医生|心理|精神|治疗|诊断|量表|挂号/i.test(
    title,
  )

let newTotal = 0
const rowsLog = resolve(SWEEP_DIR, `${new Date().toISOString().slice(0, 10)}-rows.jsonl`)

for (const { query, bucket } of queries) {
  const searchUrl = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}`
  const opened = runCli(['browser', session, 'open', searchUrl], resolve(SWEEP_DIR, '_last-open.log'))
  const evaluated = opened ? runCli(['browser', session, 'eval', js], evalTarget) : false
  consumeQuota('search')

  if (!evaluated) {
    console.log(`✗ 「${query}」执行失败（可能遇到登录墙或限流，建议停止本轮）`)
    continue
  }

  const rows = readEval()
  const fresh: Row[] = []
  for (const row of rows) {
    const entry: StateEntry = {
      firstQuery: query,
      bucket,
      title: row.title,
      author: row.author,
      likes: row.likes,
      url: row.url,
      seenAt: new Date().toISOString(),
    }
    appendFileSync(rowsLog, `${JSON.stringify({ query, bucket, ...row })}\n`, 'utf8')
    if (!state[row.note_id]) {
      state[row.note_id] = entry
      pending[row.note_id] = { ...entry, note_id: row.note_id }
      if (relevant(row.title)) fresh.push(row)
    }
  }

  newTotal += fresh.length
  console.log(`• 「${query}」命中 ${rows.length} 条，新增相关 ${fresh.length} 条`)
  for (const row of fresh.slice(0, 6)) {
    console.log(`    ${row.note_id} | ${row.title.slice(0, 44)} | ${row.author} | 赞${row.likes}`)
  }
  if (fresh.length > 6) console.log(`    …… 另有 ${fresh.length - 6} 条`)
}

writeJson(STATE_FILE, state)
writeJson(PENDING_FILE, pending)

console.log(`\n✓ 本轮完成：累计见过 ${Object.keys(state).length} 条笔记，新增相关 ${newTotal} 条`)
console.log(`✓ 待抓正文队列：${Object.keys(pending).length} 条 → ${PENDING_FILE}`)
console.log(`下一步：node scripts/collect/fetch-notes.ts --limit 40`)
