/**
 * 数据校验：schema + 引用完整性 + 隐私红线。
 * prebuild 阶段运行，任何错误都会让 next build 失败（CI 同样拦截）。
 */
import {
  doctorsFileSchema,
  disordersFileSchema,
  hospitalsFileSchema,
  provincesFileSchema,
  reportsFileSchema,
} from '../lib/schema.ts'
import { CURATED_FILES, readJson } from './lib/paths.ts'

const errors: string[] = []
const warnings: string[] = []

function parseOrReport<T extends { safeParse: (value: unknown) => { success: boolean; error?: unknown; data?: unknown } }>(
  label: string,
  schema: T,
  value: unknown,
): unknown {
  const result = schema.safeParse(value)
  if (!result.success) {
    const issues = (result.error as { issues?: Array<{ path: Array<string | number>; message: string }> })
      ?.issues ?? []
    for (const issue of issues.slice(0, 40)) {
      errors.push(`${label} → ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    }
    return null
  }
  return result.data
}

const disordersRaw = readJson<unknown>(CURATED_FILES.disorders)
const hospitalsRaw = readJson<unknown>(CURATED_FILES.hospitals)
const doctorsRaw = readJson<unknown>(CURATED_FILES.doctors)
const reportsRaw = readJson<unknown>(CURATED_FILES.reports)
const provincesRaw = readJson<unknown>(CURATED_FILES.provinces)

const disorders = parseOrReport('disorders.json', disordersFileSchema, disordersRaw) as
  | { items: Array<Record<string, unknown>> }
  | null
const hospitals = parseOrReport('hospitals.json', hospitalsFileSchema, hospitalsRaw) as
  | { items: Array<Record<string, unknown>> }
  | null
const doctors = parseOrReport('doctors.json', doctorsFileSchema, doctorsRaw) as
  | { items: Array<Record<string, unknown>> }
  | null
const reports = parseOrReport('reports.json', reportsFileSchema, reportsRaw) as
  | { items: Array<Record<string, unknown>> }
  | null
const provinces = parseOrReport('provinces.json', provincesFileSchema, provincesRaw) as
  | { items: Array<Record<string, unknown>> }
  | null

if (disorders && hospitals && doctors && reports && provinces) {
  const disorderIds = new Set(disorders.items.map((item) => String(item.id)))
  const hospitalIds = new Set(hospitals.items.map((item) => String(item.id)))
  const doctorIds = new Set(doctors.items.map((item) => String(item.id)))
  const adcodes = new Set(provinces.items.map((item) => String(item.adcode)))

  const visibleDisorders = disorders.items.filter((item) => item.visible === true)
  if (visibleDisorders.length === 0) errors.push('disorders.json: 至少要有一个 visible=true 的疾病条目')

  const seenHospitalIds = new Set<string>()
  for (const hospital of hospitals.items) {
    const id = String(hospital.id)
    if (seenHospitalIds.has(id)) errors.push(`hospitals.json: id 重复 → ${id}`)
    seenHospitalIds.add(id)
    const adcode = String(hospital.adcode)
    if (!adcodes.has(adcode)) {
      errors.push(`hospitals.json → ${id}: adcode ${adcode} 不在 provinces.json 中`)
    }
    if (Array.isArray(hospital.official_sources) && hospital.official_sources.length === 0) {
      warnings.push(`hospitals.json → ${id}: 没有官方来源，站点会以「未知」呈现其创伤服务能力`)
    }
  }

  const seenDoctorIds = new Set<string>()
  for (const doctor of doctors.items) {
    const id = String(doctor.id)
    if (seenDoctorIds.has(id)) errors.push(`doctors.json: id 重复 → ${id}`)
    seenDoctorIds.add(id)
    if (!hospitalIds.has(String(doctor.hospital_id))) {
      errors.push(`doctors.json → ${id}: hospital_id ${String(doctor.hospital_id)} 不存在`)
    }
  }

  const seenReportIds = new Set<string>()
  for (const report of reports.items) {
    const id = String(report.id)
    if (seenReportIds.has(id)) errors.push(`reports.json: id 重复 → ${id}`)
    seenReportIds.add(id)

    if (report.hospital_id && !hospitalIds.has(String(report.hospital_id))) {
      errors.push(`reports.json → ${id}: hospital_id ${String(report.hospital_id)} 不存在`)
    }
    if (report.doctor_id && !doctorIds.has(String(report.doctor_id))) {
      errors.push(`reports.json → ${id}: doctor_id ${String(report.doctor_id)} 不存在`)
    }

    const reportDisorders = Array.isArray(report.disorders) ? report.disorders : []
    for (const disorder of reportDisorders) {
      if (!disorderIds.has(String(disorder))) {
        errors.push(`reports.json → ${id}: 未知疾病条目 ${String(disorder)}`)
      }
    }

    const verification = report.verification as { level?: string } | undefined
    if (verification?.level === 'official' && !report.hospital_id) {
      warnings.push(`reports.json → ${id}: 标记 official 但没有关联医院，建议补充 hospital_id`)
    }

    const flags = report.flags as
      | { contains_minor?: boolean; contains_selfharm_detail?: boolean }
      | undefined
    const status = String(report.status)
    if (flags?.contains_minor && status === 'published') {
      errors.push(`reports.json → ${id}: 涉及未成年人，status 必须是 withheld 或 removed`)
    }
    if (flags?.contains_selfharm_detail && status === 'published') {
      errors.push(`reports.json → ${id}: 含自伤细节，status 必须是 withheld 或 removed`)
    }
    if (status === 'published' && (!report.evidence_quote || !report.source_url)) {
      errors.push(`reports.json → ${id}: 已发布线索必须同时具备 evidence_quote 与 source_url`)
    }
  }

  const published = reports.items.filter((item) => item.status === 'published').length
  console.log(
    `✓ 数据校验通过：疾病 ${disorders.items.length}、医院 ${hospitals.items.length}、医生 ${doctors.items.length}、线索 ${reports.items.length}（已发布 ${published}）、省级行政区 ${provinces.items.length}`,
  )
}

if (warnings.length > 0) {
  console.log(`\n⚠ ${warnings.length} 条提醒：`)
  for (const warning of warnings) console.log(`  - ${warning}`)
}

if (errors.length > 0) {
  console.error(`\n✗ 发现 ${errors.length} 个错误：`)
  for (const error of errors) console.error(`  - ${error}`)
  process.exit(1)
}
