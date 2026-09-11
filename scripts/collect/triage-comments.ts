/**
 * 评论分诊：把成百上千条评论压成「可入库的线索候选」。
 *
 *   node scripts/collect/triage-comments.ts --in <opencli page JSON> [--min-hits 1]
 *
 * 做三件事：
 * 1) 从 info 字段（形如 "08-31河北"）拆出日期与 IP 属地；
 * 2) 用正则抽候选医院名与医生名（评论文本 + 评论作者）；
 * 3) 按医院聚类，输出带出处（作者/时间/属地/原文）的候选清单。
 *
 * 只做机器可判定的抽取；「这家医院能不能诊断 CPTSD」这类判断留给人工与站点字段。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAW_DIR, readJson, writeJson } from '../lib/paths.ts'

type Row = { author?: string; info?: string; text?: string; likes?: string }
type Json = Record<string, unknown>

const args = process.argv.slice(2)
const take = (flag: string): string | undefined => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

const input = take('--in')
const minHits = Number(take('--min-hits') ?? '1')
if (!input) {
  console.error('用法：node scripts/collect/triage-comments.ts --in <opencli JSON> [--min-hits N]')
  process.exit(2)
}

const inputPath = resolve(process.cwd(), input)
if (!existsSync(inputPath)) {
  console.error(`找不到文件：${inputPath}`)
  process.exit(2)
}

function unwrap(value: unknown): Json[] {
  if (Array.isArray(value)) return value.filter((item): item is Json => !!item && typeof item === 'object')
  if (value && typeof value === 'object') {
    const object = value as Json
    if ('session' in object && 'data' in object) return unwrap(object.data)
    for (const key of ['data', 'rows', 'items', 'comments', 'list']) {
      if (Array.isArray(object[key])) return unwrap(object[key])
    }
    return [object]
  }
  return []
}

const parsed = readJson<unknown>(inputPath)
const list = unwrap(parsed)
const data = (list.length === 1 && Array.isArray((list[0] as Json).rows)
  ? ((list[0] as Json).rows as unknown[])
  : list) as Row[]

/** 从 "08-31河北" / "2025-08-31 广东" 拆出日期与属地 */
function splitInfo(info = ''): { date: string; ip: string } {
  const text = info.trim()
  const ipMatch = text.match(/([\u4e00-\u9fa5]{2,8})$/)
  const dateMatch = text.match(/(\d{2}-\d{2}|\d{4}-\d{2}-\d{2})/)
  return {
    date: dateMatch ? dateMatch[1] : '',
    ip: ipMatch ? ipMatch[1] : '',
  }
}

const HOSPITAL_PATTERN =
  /([\u4e00-\u9fa5]{2,14}(?:医院|精卫|脑科医院|康宁医院|卫生中心|精神卫生中心|附属医院|门诊部))/g
const DOCTOR_PATTERN = /([\u4e00-\u9fa5]{2,4})(?:医生|大夫|主任|教授)/g

type Candidate = {
  hospital: string
  mentions: number
  doctors: Set<string>
  evidences: Array<{ author: string; date: string; ip: string; text: string }>
}

const candidates = new Map<string, Candidate>()
let scanned = 0
let hits = 0

for (const row of data) {
  const text = (row.text ?? '').trim()
  if (!text) continue
  scanned += 1
  const { date, ip } = splitInfo(row.info ?? '')
  const hospitals = [...text.matchAll(HOSPITAL_PATTERN)].map((match) => match[1])
  const doctors = [...text.matchAll(DOCTOR_PATTERN)].map((match) => match[1])
  if (hospitals.length === 0 && doctors.length === 0) continue
  hits += 1

  const targets = hospitals.length > 0 ? hospitals : ['(未点名医院)']
  for (const hospital of targets) {
    const key = hospital.replace(/^(回复|补充|反馈)[:：]?/, '')
    const existing = candidates.get(key) ?? {
      hospital: key,
      mentions: 0,
      doctors: new Set<string>(),
      evidences: [],
    }
    existing.mentions += 1
    for (const doctor of doctors) existing.doctors.add(doctor)
    if (existing.evidences.length < 6) {
      existing.evidences.push({
        author: row.author ?? '',
        date,
        ip,
        text: text.length > 160 ? `${text.slice(0, 160)}…` : text,
      })
    }
    candidates.set(key, existing)
  }
}

const ranked = [...candidates.values()]
  .filter((item) => item.mentions >= minHits)
  .sort((a, b) => b.mentions - a.mentions)

const outDir = resolve(RAW_DIR, 'triage')
mkdirSync(outDir, { recursive: true })
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const outFile = resolve(outDir, `${stamp}-triage.json`)
writeJson(outFile, {
  source_file: inputPath,
  scanned,
  hits,
  candidates: ranked.map((item) => ({
    hospital: item.hospital,
    mentions: item.mentions,
    doctors: [...item.doctors],
    evidences: item.evidences,
  })),
})

console.log(`扫描评论 ${scanned} 条，含医院/医生关键词 ${hits} 条，聚类出 ${ranked.length} 个候选机构`)
console.log(`分诊结果：${outFile}\n`)
for (const item of ranked.slice(0, 30)) {
  const doctors = item.doctors.size > 0 ? ` ｜医生：${[...item.doctors].join('、')}` : ''
  console.log(`• ${item.hospital}（${item.mentions} 次）${doctors}`)
  const first = item.evidences[0]
  if (first) console.log(`    └ [${first.author}|${first.date}${first.ip}] ${first.text.slice(0, 100)}`)
}
if (ranked.length > 30) console.log(`…… 其余 ${ranked.length - 30} 个候选见分诊文件`)
