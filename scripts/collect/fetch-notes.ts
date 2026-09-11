/**
 * 批量抓正文：消费 sweep 产出的 pending 队列，把每条笔记的正文写入 data/raw/notes/<note_id>.json。
 *
 *   node scripts/collect/fetch-notes.ts [--limit 40] [--min-likes 0] [--dry-run]
 *
 * 只打印一行摘要（标题/正文长度/是否命中医院关键词），正文本身不进对话上下文，
 * 由 triage-notes.ts 再筛。
 */
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
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

const limit = Number(take('--limit') ?? '40')
const minLikes = Number(take('--min-likes') ?? '0')
const dryRun = args.includes('--dry-run')

type Pending = Record<string, { note_id: string; url: string; title: string; author: string; likes: string; firstQuery: string }>

const SWEEP_DIR = resolve(RAW_DIR, 'sweep')
const PENDING_FILE = resolve(SWEEP_DIR, 'pending.json')
const NOTES_DIR = resolve(RAW_DIR, 'notes')
mkdirSync(NOTES_DIR, { recursive: true })

if (!existsSync(PENDING_FILE)) {
  console.error('没有 pending 队列，请先运行 sweep.ts')
  process.exit(2)
}

const pending = readJson<Pending>(PENDING_FILE)
const parseLikes = (value: string): number => {
  if (!value) return 0
  const text = value.replace(/[^\d.万亿]/g, '')
  if (text.includes('万')) return Math.round(Number.parseFloat(text) * 10000) || 0
  return Number.parseInt(text, 10) || 0
}

const queue = Object.values(pending)
  .filter((item) => !existsSync(resolve(NOTES_DIR, `${item.note_id}.json`)))
  .filter((item) => parseLikes(item.likes) >= minLikes)
  .slice(0, limit)

if (queue.length === 0) {
  console.log('队列为空（或都已抓取）。可以再跑 sweep.ts 找新笔记。')
  process.exit(0)
}

console.log(`待抓 ${queue.length} 条笔记${dryRun ? '（dry-run）' : ''}`)
const HOSPITAL_HINT = /医院|门诊|医生|确诊|诊断|挂号|量表|精神科|心理科|创伤|cptsd|ptsd|bpd|解离/i

let ok = 0
let fail = 0
for (const item of queue) {
  if (dryRun) {
    console.log(`  · ${item.note_id} | ${item.title.slice(0, 40)}`)
    continue
  }
  const outFile = resolve(NOTES_DIR, `${item.note_id}.json`)
  const fd = openSync(outFile, 'w')
  const result = spawnSync(process.execPath, [OPENCLI_ENTRY, 'xiaohongshu', 'note', item.url, '-f', 'json'], {
    stdio: ['ignore', fd, 'inherit'],
    windowsHide: true,
  })
  closeSync(fd)
  consumeQuota('note')

  if (result.status !== 0) {
    fail += 1
    writeFileSync(outFile, JSON.stringify({ error: `exit ${result.status}`, ...item }, null, 2), 'utf8')
    console.log(`  ✗ ${item.note_id} 抓取失败`)
    continue
  }

  let content = ''
  let title = item.title
  try {
    const parsed = JSON.parse(readFileSync(outFile, 'utf8')) as Array<{ field: string; value: string }>
    for (const pair of parsed) {
      if (pair.field === 'content') content = pair.value ?? ''
      if (pair.field === 'title') title = pair.value || title
    }
  } catch {
    /* 保留原始文件 */
  }

  // 把 pending 里的元信息并入笔记文件，便于后续追溯
  writeJson(outFile, { note_id: item.note_id, url: item.url, title, author: item.author, likes: item.likes, firstQuery: item.firstQuery, fields: JSON.parse(readFileSync(outFile, 'utf8')), content })

  ok += 1
  const hits = HOSPITAL_HINT.test(content)
  console.log(`  ${hits ? '★' : '·'} ${item.note_id} | ${title.slice(0, 34)} | 正文 ${content.length} 字${hits ? ' | 命中医院/就诊关键词' : ''}`)

  delete pending[item.note_id]
  writeJson(PENDING_FILE, pending)
}

console.log(`\n✓ 成功 ${ok} 条，失败 ${fail} 条；pending 剩余 ${Object.keys(pending).length} 条`)
console.log('下一步：node scripts/collect/triage-notes.ts')
