/**
 * 把 OpenCLI 的小红书输出转成待补全草稿。
 *
 *   opencli xiaohongshu search "CPTSD 确诊" --limit 20 -f json  > tmp/search.json
 *   node scripts/collect/import-opencli.ts --in tmp/search.json --kind search --run 2026-09-11-xhs-1
 *
 * 这一步只做结构化与非语义字段提取（note_id / 链接 / 作者 / 时间 / IP 属地 / 正文）。
 * 「这条笔记提到的医院、医生、疾病、就诊阶段」必须由人来判断后填入草稿，
 * 脚本不会替你猜 —— 猜测会直接污染公开数据集。
 */
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR, readJson, today, writeJson } from '../lib/paths.ts'

type Json = Record<string, unknown>

const args = process.argv.slice(2)
const inIndex = args.indexOf('--in')
const kindIndex = args.indexOf('--kind')
const runIndex = args.indexOf('--run')

if (inIndex < 0) {
  console.error(
    '用法：node scripts/collect/import-opencli.ts --in opencli.json [--kind search|note|comments] [--run <run_id>]',
  )
  process.exit(2)
}

const inputPath = resolve(process.cwd(), args[inIndex + 1] ?? '')
const kind = (kindIndex >= 0 ? args[kindIndex + 1] : 'search') ?? 'search'
const runId = runIndex >= 0 ? (args[runIndex + 1] ?? `xhs-${today()}`) : `xhs-${today()}`

const raw = readJson<unknown>(inputPath)

function asArray(value: unknown): Json[] {
  if (Array.isArray(value)) return value.filter((item): item is Json => typeof item === 'object' && item !== null)
  if (value && typeof value === 'object') {
    const object = value as Json
    for (const key of ['data', 'items', 'notes', 'results', 'list']) {
      const candidate = object[key]
      if (Array.isArray(candidate)) {
        return candidate.filter((item): item is Json => typeof item === 'object' && item !== null)
      }
    }
    return [object]
  }
  return []
}

function pick(object: Json, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = object[key]
    if (typeof value === 'string' && value.trim().length > 0) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function pickAuthor(object: Json): string | undefined {
  const direct = pick(object, ['author', 'author_name', 'nickname', 'user_name', 'user'])
  if (direct) return direct
  for (const key of ['author', 'user', 'user_info']) {
    const nested = object[key]
    if (nested && typeof nested === 'object') {
      const value = pick(nested as Json, ['nickname', 'name', 'nick_name', 'user_name', 'id', 'user_id'])
      if (value) return value
    }
  }
  return undefined
}

const rows = asArray(raw)
const drafts = rows.map((row) => {
  const noteId = pick(row, ['note_id', 'noteId', 'id', 'note-id'])
  const url = pick(row, ['url', 'link', 'note_url', 'noteUrl', 'share_link'])
  const title = pick(row, ['title', 'display_title', 'displayTitle'])
  const desc = pick(row, ['desc', 'description', 'content', 'text', 'note_text'])
  const author = pickAuthor(row)
  const publishedAt = pick(row, ['publish_time', 'publishTime', 'time', 'date', 'create_time', 'created_at'])
  const ipLocation = pick(row, ['ip_location', 'ipLocation', 'ip', 'location'])

  const missing: string[] = []
  if (!noteId && !url) missing.push('note_id/url')
  if (!author) missing.push('author')
  if (!desc) missing.push('正文（可能需要打开笔记详情）')

  return {
    kind,
    note_id: noteId,
    source_url: url ?? (noteId ? `https://www.xiaohongshu.com/explore/${noteId}` : undefined),
    title,
    desc,
    author_nickname: author,
    published_at: publishedAt,
    published_at_precision: publishedAt && /\d{4}-\d{2}-\d{2}/.test(publishedAt) ? 'day' : 'unknown',
    ip_location: ipLocation,
    missing,
    needs_human_review: [
      'hospital_id / hospital_name_raw（这条笔记提到哪家医院？）',
      'department / doctor_name_raw（科室与医生）',
      'disorders（CPTSD / BPD / 其他）',
      'stage（求医 / 已就诊 / 已确诊 …）',
      'evidence_quote（逐字摘录 ≤200 字，必须来自原文）',
      'flags（是否涉及未成年人、自伤细节）',
    ],
    run_id: runId,
  }
})

const draftsDir = resolve(RAW_DIR, 'drafts')
mkdirSync(draftsDir, { recursive: true })
const outFile = resolve(draftsDir, `${runId}-${kind}-${Date.now()}.json`)
writeJson(outFile, { run_id: runId, kind, imported_at: new Date().toISOString(), count: drafts.length, drafts })

console.log(`✓ 已解析 ${drafts.length} 条「${kind}」结果 → ${outFile}`)
const incomplete = drafts.filter((draft) => draft.missing.length > 0)
if (incomplete.length > 0) {
  console.log(`⚠ ${incomplete.length} 条缺少基础字段，需要先打开笔记详情补齐：`)
  for (const draft of incomplete.slice(0, 10)) {
    console.log(`  - ${draft.note_id ?? draft.source_url ?? '(无标识)'}：缺 ${draft.missing.join('、')}`)
  }
}
console.log('\n下一步：人工判断每条笔记提到的医院/医生/疾病/阶段 → 补全为 draft.json → 运行 npm run collect:record')
console.log('注意：草稿保存在 data/raw/（gitignored），其中含真实昵称，不要复制进 data/curated/。')
