/**
 * 批量抓评论：对指定（或分诊出的高价值）笔记打开详情页，滚动加载并抽取评论。
 *
 *   node scripts/collect/fetch-comments.ts --ids <note_id,note_id> [--limit 10]
 *   node scripts/collect/fetch-comments.ts --from-triage <triage.json> --limit 10
 *   node scripts/collect/fetch-comments.ts --top 10          # 按分诊命中数取前 N 条
 *
 * 产物：data/raw/comments/<note_id>.json（含作者、时间+IP 属地、正文、点赞）
 * 只打印一行摘要，正文不进对话上下文。
 */
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { RAW_DIR, readJson, writeJson } from '../lib/paths.ts'
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
const limit = Number(take('--limit') ?? '10')
const top = Number(take('--top') ?? '0')
const idsArg = take('--ids')
const fromTriage = take('--from-triage')

const NOTES_DIR = resolve(RAW_DIR, 'notes')
const COMMENTS_DIR = resolve(RAW_DIR, 'comments')
const TRIAGE_DIR = resolve(RAW_DIR, 'triage')
mkdirSync(COMMENTS_DIR, { recursive: true })

type NoteFile = { note_id?: string; url?: string; title?: string; hits?: number }
type TriageFile = { candidates: Array<{ note_id: string; hits: number; title: string }> }

function latestTriage(): TriageFile | null {
  if (!existsSync(TRIAGE_DIR)) return null
  const files = readdirSync(TRIAGE_DIR)
    .filter((name) => name.startsWith('notes-'))
    .sort()
  const last = files[files.length - 1]
  return last ? readJson<TriageFile>(resolve(TRIAGE_DIR, last)) : null
}

let targets: string[] = []
if (idsArg) {
  targets = idsArg.split(',').map((value) => value.trim()).filter(Boolean)
} else if (fromTriage) {
  const file = readJson<TriageFile>(resolve(process.cwd(), fromTriage))
  targets = file.candidates.map((item) => item.note_id)
} else if (top > 0) {
  const triage = latestTriage()
  if (!triage) {
    console.error('找不到分诊文件，请先运行 triage-notes.ts')
    process.exit(2)
  }
  targets = triage.candidates.slice(0, top).map((item) => item.note_id)
} else {
  console.error('用法：--ids a,b | --from-triage <file> | --top N')
  process.exit(2)
}

targets = targets.slice(0, limit)
if (targets.length === 0) {
  console.log('没有目标笔记。')
  process.exit(0)
}

const js = readFileSync(resolve(process.cwd(), 'scripts/collect/js/extract-comments.js'), 'utf8')
const HOSPITAL_HINT = /医院|门诊|医生|确诊|诊断|挂号|量表|精神科|心理科|创伤|cptsd|ptsd|bpd|解离/i

console.log(`准备抓取 ${targets.length} 条笔记的评论`)

let ok = 0
let skipped = 0
for (const noteId of targets) {
  const notePath = resolve(NOTES_DIR, `${noteId}.json`)
  if (!existsSync(notePath)) {
    console.log(`  ✗ ${noteId}：缺少笔记文件，先跑 fetch-notes.ts`)
    continue
  }
  const note = readJson<NoteFile>(notePath)
  if (!note.url) {
    console.log(`  ✗ ${noteId}：笔记文件里没有签名 URL`)
    continue
  }

  const outFile = resolve(COMMENTS_DIR, `${noteId}.json`)
  if (existsSync(outFile)) {
    skipped += 1
    continue
  }

  const openLog = resolve(COMMENTS_DIR, `_open-${noteId}.log`)
  const fdOpen = openSync(openLog, 'w')
  const opened = spawnSync(process.execPath, [OPENCLI_ENTRY, 'browser', session, 'open', note.url], {
    stdio: ['ignore', fdOpen, 'inherit'],
    windowsHide: true,
  })
  closeSync(fdOpen)

  const fdEval = openSync(outFile, 'w')
  const evaluated =
    opened.status === 0
      ? spawnSync(process.execPath, [OPENCLI_ENTRY, 'browser', session, 'eval', js], {
          stdio: ['ignore', fdEval, 'inherit'],
          windowsHide: true,
        })
      : { status: 1 }
  closeSync(fdEval)
  consumeQuota('comments')

  if (evaluated.status !== 0) {
    console.log(`  ✗ ${noteId}：评论抓取失败`)
    continue
  }

  let rows: Array<{ author?: string; info?: string; text?: string }> = []
  try {
    const parsed = JSON.parse(readFileSync(outFile, 'utf8')) as unknown
    const payload =
      parsed && typeof parsed === 'object' && 'data' in (parsed as object)
        ? (parsed as { data: unknown }).data
        : parsed
    rows = ((payload as { rows?: typeof rows })?.rows ?? []) as typeof rows
  } catch {
    /* 保留原始输出 */
  }

  const hitCount = rows.filter((row) => HOSPITAL_HINT.test(row.text ?? '')).length
  writeJson(outFile, { note_id: noteId, url: note.url, title: note.title ?? '', count: rows.length, hitCount, rows })
  ok += 1
  console.log(`  ★ ${noteId} | ${(note.title ?? '').slice(0, 30)} | 评论 ${rows.length} 条，其中 ${hitCount} 条提到医院/就诊`)
}

console.log(`\n✓ 完成 ${ok} 条，跳过已存在 ${skipped} 条 → ${COMMENTS_DIR}`)
console.log('下一步：node scripts/collect/triage-comments.ts --in <某个评论文件>')
