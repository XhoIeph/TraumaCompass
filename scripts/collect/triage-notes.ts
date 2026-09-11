/**
 * 笔记分诊：把已抓取的正文按「是否提到医院/医生/就诊」筛出来，压成可入库的候选清单。
 *
 *   node scripts/collect/triage-notes.ts [--min-hits 1] [--limit 60] [--all]
 *
 * 只打印命中摘要（含原句片段），完整候选写入 data/raw/triage/notes-<ts>.json。
 * 已转成线索的笔记记录在 data/raw/notes/_processed.json，默认跳过（--all 可强制重看）。
 */
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR, readJson, writeJson } from '../lib/paths.ts'

const args = process.argv.slice(2)
const take = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}
const minHits = Number(take('--min-hits') ?? '1')
const limit = Number(take('--limit') ?? '60')
const includeProcessed = args.includes('--all')

const NOTES_DIR = resolve(RAW_DIR, 'notes')
const PROCESSED_FILE = resolve(NOTES_DIR, '_processed.json')
const processed: Record<string, string> = existsSync(PROCESSED_FILE)
  ? readJson<Record<string, string>>(PROCESSED_FILE)
  : {}

const HOSPITAL_PATTERN =
  /([\u4e00-\u9fa5]{2,16}(?:医院|精卫|脑科医院|康宁医院|卫生中心|精神卫生中心|附属医院|门诊部|心理科|精神科|心理门诊|创伤门诊))/g
const DOCTOR_PATTERN = /([\u4e00-\u9fa5]{2,4})(?:医生|大夫|主任|教授)/g
const CITY_PATTERN = /([\u4e00-\u9fa5]{2,8}(?:市|省|自治区|区|县))/g

type NoteFile = {
  note_id?: string
  title?: string
  author?: string
  likes?: string
  url?: string
  firstQuery?: string
  content?: string
  fields?: Array<{ field: string; value: string }>
  error?: string
}

function contentOf(note: NoteFile): string {
  if (typeof note.content === 'string' && note.content) return note.content
  if (Array.isArray(note.fields)) {
    return note.fields.find((pair) => pair.field === 'content')?.value ?? ''
  }
  return ''
}

const files = existsSync(NOTES_DIR)
  ? readdirSync(NOTES_DIR).filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  : []

type Candidate = {
  note_id: string
  title: string
  author: string
  likes: string
  url: string
  firstQuery: string
  hits: number
  hospitals: string[]
  doctors: string[]
  cities: string[]
  snippets: string[]
}

const candidates: Candidate[] = []
let scanned = 0

for (const file of files) {
  const note = readJson<NoteFile>(resolve(NOTES_DIR, file))
  const noteId = note.note_id ?? file.replace(/\.json$/, '')
  if (note.error) continue
  if (!includeProcessed && processed[noteId]) continue
  const content = contentOf(note)
  if (!content) continue
  scanned += 1

  const hospitals = [...new Set([...content.matchAll(HOSPITAL_PATTERN)].map((m) => m[1]))]
  const doctors = [...new Set([...content.matchAll(DOCTOR_PATTERN)].map((m) => m[1]))]
  const cities = [...new Set([...content.matchAll(CITY_PATTERN)].map((m) => m[1]))].slice(0, 6)
  const hits = hospitals.length + doctors.length
  if (hits < minHits) continue

  const snippets: string[] = []
  for (const sentence of content.split(/[。！？\n]/)) {
    const text = sentence.trim()
    if (text.length < 6) continue
    if (HOSPITAL_PATTERN.test(text) || DOCTOR_PATTERN.test(text)) {
      snippets.push(text.slice(0, 140))
    }
    if (snippets.length >= 3) break
  }

  candidates.push({
    note_id: noteId,
    title: note.title ?? '',
    author: note.author ?? '',
    likes: note.likes ?? '',
    url: note.url ?? '',
    firstQuery: note.firstQuery ?? '',
    hits,
    hospitals,
    doctors,
    cities,
    snippets,
  })
}

candidates.sort((a, b) => b.hits - a.hits)

const outDir = resolve(RAW_DIR, 'triage')
mkdirSync(outDir, { recursive: true })
const outFile = resolve(outDir, `notes-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
writeJson(outFile, { scanned, candidates })

console.log(`扫描已抓正文 ${scanned} 条，命中医院/医生关键词 ${candidates.length} 条`)
console.log(`完整候选：${outFile}\n`)
for (const item of candidates.slice(0, limit)) {
  console.log(`★ ${item.note_id} | ${item.title.slice(0, 36)} | ${item.author} | 赞${item.likes} | 命中 ${item.hits}`)
  if (item.hospitals.length) console.log(`   医院：${item.hospitals.slice(0, 6).join('、')}`)
  if (item.doctors.length) console.log(`   医生：${item.doctors.slice(0, 8).join('、')}`)
  if (item.snippets[0]) console.log(`   原句：${item.snippets[0]}`)
}
if (candidates.length > limit) console.log(`…… 其余 ${candidates.length - limit} 条见候选文件`)
console.log(`\n转成线索后，把 note_id 记入 ${PROCESSED_FILE}，避免重复分诊。`)
