/**
 * OpenCLI 调用包装：强制配额 + 原始输出落盘 + 只回显精简摘要。
 *
 * 站内适配器：
 *   node scripts/collect/run-opencli.ts search "CPTSD 确诊" [--limit 10]
 *   node scripts/collect/run-opencli.ts note "<带 xsec_token 的链接>"
 *   node scripts/collect/run-opencli.ts comments "<链接>" [--limit 10]
 *
 * 浏览器原语（站内适配器的列表抽取只回 1 条时使用）：
 *   node scripts/collect/run-opencli.ts page --url "<搜索页>" --js-file tmp/extract-search.js [--session tc]
 *
 * 设计取舍：
 * - 原始 JSON 写进 data/raw/opencli/（gitignored），**不打印到对话里**；
 *   只回显判断所需的最小信息（id/标题/作者/时间/互动/正文摘录）。
 * - stdout 直接重定向到文件（不走管道）。
 * - 每次调用前 check、成功后 consume 配额；超额直接拒绝执行。
 * - page 模式按一次「搜索级」请求记账（它同样是一次真实页面加载）。
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { RAW_DIR, today } from '../lib/paths.ts'
import { type QuotaKind, consumeQuota, formatQuota, loadQuota, remainingQuota } from './quota-lib.ts'

const OPENCLI_ENTRY =
  process.env.OPENCLI_ENTRY ??
  'C:\\Users\\Lenovo\\.dsh\\profiles\\web\\node_modules\\@jackwener\\opencli\\dist\\src\\main.js'

type Json = Record<string, unknown>

/** 取 --flag value；同时把这一对从 rest 中摘掉 */
function takeFlag(rest: string[], flag: string): string | undefined {
  const index = rest.indexOf(flag)
  if (index < 0) return undefined
  const value = rest[index + 1]
  rest.splice(index, value === undefined ? 1 : 2)
  return value
}

function rowsOf(value: unknown): Json[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Json => !!item && typeof item === 'object')
  }
  if (value && typeof value === 'object') {
    const object = value as Json
    if ('session' in object && 'data' in object) return rowsOf(object.data)
    for (const key of ['data', 'items', 'notes', 'results', 'list', 'comments', 'rows']) {
      if (Array.isArray(object[key])) return rowsOf(object[key])
    }
    return [object]
  }
  return []
}

function pick(object: Json, keys: string[]): string {
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return ''
}

const shorten = (value: string, max = 64) => (value.length > max ? `${value.slice(0, max)}…` : value)
const noteIdOf = (url: string) => url.match(/\/(?:search_result|explore)\/([0-9a-f]{24})/i)?.[1] ?? ''

const outDir = resolve(RAW_DIR, 'opencli')
mkdirSync(outDir, { recursive: true })

function outPath(label: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const slug = label.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-').slice(0, 40)
  return resolve(outDir, `${stamp}-${slug}.json`)
}

/** 运行 opencli 并把 stdout 直接写进文件（不走管道，避免受限沙箱的命名管道限制） */
function runCli(cliArgs: string[], target: string): { ok: boolean; status: number | null } {
  const fd = openSync(target, 'w')
  const result = spawnSync(process.execPath, [OPENCLI_ENTRY, ...cliArgs], {
    stdio: ['ignore', fd, 'inherit'],
    windowsHide: true,
  })
  closeSync(fd)
  return { ok: result.status === 0, status: result.status }
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const args = process.argv.slice(2)
const command = args[0]
if (!command) {
  console.error(
    '用法：node scripts/collect/run-opencli.ts <search|note|comments|page> …（见文件头注释）',
  )
  process.exit(2)
}

/* ------------------------------------------------------------------ page 模式 */

if (command === 'page') {
  const rest = args.slice(1)
  const url = takeFlag(rest, '--url')
  const jsFile = takeFlag(rest, '--js-file')
  const session = takeFlag(rest, '--session') ?? 'tc'
  const kind = (takeFlag(rest, '--kind') ?? 'search') as QuotaKind

  if (!jsFile) {
    console.error('page 模式需要 --js-file <包含 JS 的文件>')
    process.exit(2)
  }
  const jsPath = resolve(process.cwd(), jsFile)
  if (!existsSync(jsPath)) {
    console.error(`找不到 JS 文件：${jsPath}`)
    process.exit(2)
  }
  const js = readFileSync(jsPath, 'utf8')

  const state = loadQuota()
  if (remainingQuota(state, kind) <= 0) {
    console.error(`✗ 今日「${kind}」配额已用尽，拒绝执行。`)
    process.exit(1)
  }

  if (url) {
    const openTarget = outPath('browser-open')
    const opened = runCli(['browser', session, 'open', url], openTarget)
    if (!opened.ok) {
      console.error(`✗ 打开页面失败（exit ${opened.status}）：${openTarget}`)
      process.exit(opened.status ?? 1)
    }
  }

  const evalTarget = outPath(`page-${command}`)
  const evaluated = runCli(['browser', session, 'eval', js], evalTarget)
  if (!evaluated.ok) {
    console.error(`✗ 页面 JS 执行失败（exit ${evaluated.status}）：${evalTarget}`)
    process.exit(evaluated.status ?? 1)
  }

  const after = consumeQuota(kind)
  console.log(`✓ page 完成（${kind} 配额 ${formatQuota(after)}）`)
  console.log(`  原始输出：${evalTarget}`)

  const parsed = readJsonFile(evalTarget)
  const payload = rowsOf(parsed)
  const first = payload[0] as Json | undefined
  // eval 结果可能是 {count,rows:[...]}，也可能直接就是行数组
  const list =
    first && Array.isArray(first.rows)
      ? (first.rows as unknown[]).filter((item): item is Json => !!item && typeof item === 'object')
      : payload.filter((item) => 'url' in item || 'title' in item)
  if (list.length > 0) {
    console.log(`  页面：${first && typeof first.url === 'string' ? first.url : '(未知)'}`)
    console.log(`  抽取到 ${list.length} 条笔记`)
    for (const [index, row] of list.slice(0, 25).entries()) {
      const url = pick(row, ['url'])
      console.log(
        `  ${String(index + 1).padStart(2)}. ${noteIdOf(url) || '?'} | ${shorten(pick(row, ['title']) || '(无标题)')} | ${pick(row, ['author']) || '?'} | 赞${pick(row, ['likes']) || '?'}`,
      )
    }
  } else {
    console.log(`  返回 ${payload.length} 条记录（结构未识别，见原始文件）`)
  }
  process.exit(0)
}

/* ------------------------------------------------------- site adapter 模式 */

const kind: QuotaKind = command === 'search' ? 'search' : command === 'comments' ? 'comments' : 'note'
const rest = args.slice(1)
const limitArg = takeFlag(rest, '--limit')
const runId = takeFlag(rest, '--run') ?? `xhs-${today()}`
const positional = rest.filter((value) => !value.startsWith('--'))

if (positional.length === 0) {
  console.error(`缺少参数：${command === 'search' ? '检索词' : '笔记链接'}`)
  process.exit(2)
}

{
  const state = loadQuota()
  if (remainingQuota(state, kind) <= 0) {
    console.error(`✗ 今日「${kind}」配额已用尽，拒绝执行。`)
    process.exit(1)
  }
}

const cliArgs = ['xiaohongshu', command, ...positional, '-f', 'json']
if (limitArg) cliArgs.splice(3, 0, '--limit', limitArg)

const outFile = outPath(`${command}-${positional[0]}`)
const executed = runCli(cliArgs, outFile)
if (!executed.ok) {
  console.error(`✗ opencli 退出码 ${executed.status}；原始输出：${outFile}`)
  process.exit(executed.status ?? 1)
}

const after = consumeQuota(kind)
console.log(`✓ ${command} 完成（${kind} 配额 ${formatQuota(after)}）`)
console.log(`  原始输出：${outFile}`)

const parsed = readJsonFile(outFile)
if (parsed === null) {
  console.log('  （输出不是 JSON，请查看原始文件）')
  process.exit(0)
}

// note 返回 [{field, value}] 键值对；先归一化成对象
const rawRows = rowsOf(parsed)
const isFieldValue = rawRows.length > 0 && rawRows.every((row) => 'field' in row && 'value' in row)
if (isFieldValue) {
  const flat: Json = {}
  for (const row of rawRows) flat[String(row.field)] = row.value
  const content = pick(flat, ['content', 'desc'])
  console.log(`  笔记：《${pick(flat, ['title']) || '(无标题)'}》 by ${pick(flat, ['author']) || '?'}`)
  console.log(
    `  互动：赞${pick(flat, ['likes']) || '?'} 藏${pick(flat, ['collects']) || '?'} 评${pick(flat, ['comments']) || '?'}｜标签：${pick(flat, ['tags']) || '无'}`,
  )
  console.log(`  正文（前 200 字）：${shorten(content, 200)}`)
  console.log(`  正文长度：${content.length} 字`)
  process.exit(0)
}

console.log(`  解析到 ${rawRows.length} 条记录`)
for (const [index, row] of rawRows.slice(0, 25).entries()) {
  const url = pick(row, ['url', 'note_url', 'link'])
  const id = pick(row, ['note_id', 'noteId', 'id']) || noteIdOf(url)
  const title = pick(row, ['title', 'display_title', 'desc', 'text'])
  const author = pick(row, ['author', 'author_name', 'nickname', 'user_name'])
  const date = pick(row, ['published_at', 'publish_time', 'time', 'date'])
  const likes = pick(row, ['likes', 'liked_count'])
  console.log(
    `  ${String(index + 1).padStart(2)}. ${id || '?'} | ${shorten(title || '(无文本)')} | ${author || '?'} | ${date || '?'} | 赞${likes || '?'}`,
  )
}
if (rawRows.length > 25) console.log(`  …… 其余 ${rawRows.length - 25} 条见原始文件`)
console.log(`\n下一步：node scripts/collect/import-opencli.ts --in "${outFile}" --kind ${command} --run ${runId}`)
