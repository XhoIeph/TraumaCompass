/**
 * 批量线索导入器：把一份精简的「线索清单」转成机构条目 + 线索草稿。
 *
 *   node scripts/collect/import-leads.ts --in tmp/leads/batch1.json
 *
 * 清单格式（数组）：
 * {
 *   "hospital": { "id","name","aliases","adcode","province","city","category","departments","level"? },
 *   "report": {
 *     "source_note_id", "source_url", "suffix", "author_nickname", "published_at",
 *     "disorders", "doctor_name_raw"?, "department"?, "ip_location"?, "evidence_quote",
 *     "stage"?, "experience"?, "verification_level"?, "verification_notes"?, "evidence_source"?
 *   }
 * }
 *
 * - 已存在的机构 id 不会重复写入（只补线索）。
 * - 医院条目一律以「网友/汇总来源」作为 trauma_service.evidence，level 未知、official_sources 为空，
 *   等官方核实阶段再升格 —— 不要在导入阶段替机构下结论。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Hospital } from '../../lib/schema.ts'
import { CURATED_FILES, readJson, today, writeJson } from '../lib/paths.ts'

type LeadHospital = {
  id: string
  name: string
  aliases?: string[]
  adcode: string
  province: string
  city: string
  category: Hospital['category']
  departments: string[]
  level?: Hospital['level']
}

type Lead = {
  hospital: LeadHospital
  report?: {
    source_note_id: string
    source_url: string
    suffix: string
    author_nickname: string
    published_at: string
    disorders: string[]
    doctor_name_raw?: string
    department?: string
    ip_location?: string
    hospital_region?: string
    evidence_quote: string
    stage?: string
    experience?: number | null
    cost_cny?: { min?: number; max?: number }
    verification_level?: string
    verification_notes?: string
    evidence_source?: string
    evidence_label: string
  }
  /** 只补机构、不生成线索时使用（例如官方名单类证据） */
  evidence?: string
}

const args = process.argv.slice(2)
const index = args.indexOf('--in')
if (index < 0) {
  console.error('用法：node scripts/collect/import-leads.ts --in tmp/leads/batch1.json')
  process.exit(2)
}
const inputPath = resolve(process.cwd(), args[index + 1] ?? '')
if (!existsSync(inputPath)) {
  console.error(`找不到清单文件：${inputPath}`)
  process.exit(2)
}

const leads = readJson<Lead[]>(inputPath)
const hospitalsFile = readJson<{ schema_version: string; updated_at: string; items: Hospital[] }>(
  CURATED_FILES.hospitals,
)
const existing = new Set(hospitalsFile.items.map((item) => item.id))

const draftsDir = resolve(process.cwd(), 'tmp/drafts')
mkdirSync(draftsDir, { recursive: true })
const createdDrafts: string[] = []
let addedHospitals = 0
let skippedHospitals = 0

for (const lead of leads) {
  const { hospital, report, evidence } = lead
  const evidenceLabel = report?.evidence_label ?? evidence ?? ''

  if (!existing.has(hospital.id)) {
    hospitalsFile.items.push({
      id: hospital.id,
      name: hospital.name,
      aliases: hospital.aliases ?? [],
      adcode: hospital.adcode,
      province: hospital.province,
      city: hospital.city,
      level: hospital.level ?? '未知',
      category: hospital.category,
      departments: hospital.departments,
      trauma_service: {
        cptsd_assessment: 'claimed',
        cptsd_bpd_diagnosis: 'claimed',
        icd11_practice: 'unknown',
        evidence: evidenceLabel ? [evidenceLabel] : [],
      },
      coordinates: null,
      official_sources: [],
      last_verified_at: today(),
    })
    existing.add(hospital.id)
    addedHospitals += 1
  } else {
    skippedHospitals += 1
    const target = hospitalsFile.items.find((item) => item.id === hospital.id)
    if (target && evidenceLabel && !target.trauma_service.evidence.includes(evidenceLabel)) {
      target.trauma_service.evidence.push(evidenceLabel)
      if (target.trauma_service.cptsd_assessment === 'unknown') {
        target.trauma_service.cptsd_assessment = 'claimed'
        target.trauma_service.cptsd_bpd_diagnosis = 'claimed'
      }
    }
  }

  // 只补机构（官方名单类）：不生成线索草稿
  if (!report) continue

  const draft = {
    platform: 'xiaohongshu',
    source_url: report.source_url,
    // 同一帖可以有多条线索，因此 post_id 必须带后缀；
    // 后缀里再拼上机构 id，否则同一帖+同后缀的不同机构会拿到相同记录 id 而被去重误杀。
    source_post_id: `${report.source_note_id}${report.suffix}-${hospital.id}`,
    author_nickname: report.author_nickname,
    published_at: report.published_at,
    published_at_precision: 'derived',
    hospital_id: hospital.id,
    hospital_name_raw: hospital.name,
    hospital_region: report.hospital_region ?? `${hospital.province}${hospital.city}`,
    department: report.department ?? hospital.departments[0],
    doctor_name_raw: report.doctor_name_raw,
    ip_location: report.ip_location,
    disorders: report.disorders,
    stage: report.stage ?? 'unknown',
    experience: report.experience ?? null,
    cost_cny: report.cost_cny,
    evidence_quote: report.evidence_quote,
    evidence_source: report.evidence_source ?? 'note_body',
    verification_level: report.verification_level ?? 'unverified',
    verification_notes: report.verification_notes,
    flags: { sensitive: false },
    run_id: `2026-09-11-xhs-1`,
    tool: 'opencli xiaohongshu (notes + comments)',
  }

  const draftFile = resolve(draftsDir, `lead-${hospital.id}-${report.suffix.replace(/[^a-z0-9]/gi, '')}.json`)
  writeJson(draftFile, draft)
  createdDrafts.push(draftFile)
}

hospitalsFile.updated_at = today()
writeJson(CURATED_FILES.hospitals, hospitalsFile)

console.log(`✓ 机构：新增 ${addedHospitals} 家，命中已有 ${skippedHospitals} 家（已补证据）`)
console.log(`✓ 生成线索草稿 ${createdDrafts.length} 份 → ${draftsDir}`)
console.log('\n下一步：逐个 node scripts/collect/record.ts --in <草稿>')
