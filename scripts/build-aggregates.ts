/**
 * 由 curated 数据生成省级聚合（data/generated/province-stats.json）。
 * 站点地图直接消费这个文件，避免在浏览器里重复计算。
 */
import type { Doctor, Hospital, Province, Report } from '../lib/schema.ts'
import { matchProvinceAdcode } from '../lib/region.ts'
import { CURATED_FILES, GENERATED_DIR, readJson, writeJson } from './lib/paths.ts'
import { resolve } from 'node:path'

const provinces = readJson<{ items: Province[] }>(CURATED_FILES.provinces).items
const hospitals = readJson<{ items: Hospital[] }>(CURATED_FILES.hospitals).items
const doctors = readJson<{ items: Doctor[] }>(CURATED_FILES.doctors).items
const reports = readJson<{ items: Report[] }>(CURATED_FILES.reports).items

const publishedReports = reports.filter((report) => report.status === 'published')
const hospitalById = new Map(hospitals.map((hospital) => [hospital.id, hospital]))

/** 线索 → 省级行政区：优先医院所在地，其次用 IP 属地/自述地区文本匹配省名或简称 */
function reportAdcode(report: Report): string | undefined {
  if (report.hospital_id) {
    const hospital = hospitalById.get(report.hospital_id)
    if (hospital) return hospital.adcode
  }
  return matchProvinceAdcode(
    [report.ip_location, report.self_reported_region, report.hospital_region],
    provinces,
  )
}

const emptyItem = (province: Province) => ({
  adcode: province.adcode,
  reports_total: 0,
  reports_by_disorder: { cptsd: 0, bpd: 0 },
  reports_by_platform: {} as Record<string, number>,
  hospitals_total: 0,
  hospitals_with_service_evidence: 0,
  doctors_total: 0,
  verification: { official: 0, corroborated: 0, unverified: 0 },
})

const items = new Map(provinces.map((province) => [province.adcode, emptyItem(province)]))
let unlocated = 0

for (const report of publishedReports) {
  const adcode = reportAdcode(report)
  if (!adcode) {
    unlocated += 1
    continue
  }
  const item = items.get(adcode)
  if (!item) continue
  item.reports_total += 1
  if (report.disorders.includes('cptsd')) item.reports_by_disorder.cptsd += 1
  if (report.disorders.includes('bpd')) item.reports_by_disorder.bpd += 1
  item.reports_by_platform[report.platform] = (item.reports_by_platform[report.platform] ?? 0) + 1
  item.verification[report.verification.level] += 1
}

for (const hospital of hospitals) {
  const item = items.get(hospital.adcode)
  if (!item) continue
  item.hospitals_total += 1
  const hasEvidence =
    hospital.trauma_service.evidence.length > 0 ||
    hospital.trauma_service.cptsd_assessment !== 'unknown' ||
    hospital.trauma_service.cptsd_bpd_diagnosis !== 'unknown'
  if (hasEvidence) item.hospitals_with_service_evidence += 1
}

for (const doctor of doctors) {
  const hospital = hospitalById.get(doctor.hospital_id)
  if (!hospital) continue
  const item = items.get(hospital.adcode)
  if (!item) continue
  item.doctors_total += 1
}

const statsItems = [...items.values()].sort((a, b) => a.adcode.localeCompare(b.adcode))

const output = {
  schema_version: '1.0.0',
  generated_at: new Date().toISOString(),
  totals: {
    reports: publishedReports.length,
    reports_unlocated: unlocated,
    hospitals: hospitals.length,
    doctors: doctors.length,
    provinces_with_reports: statsItems.filter((item) => item.reports_total > 0).length,
    provinces_with_hospitals: statsItems.filter((item) => item.hospitals_total > 0).length,
  },
  items: statsItems,
}

writeJson(resolve(GENERATED_DIR, 'province-stats.json'), output)

console.log(
  `✓ 聚合完成：已发布线索 ${output.totals.reports}（未定位 ${unlocated}）、医院 ${output.totals.hospitals}、医生 ${output.totals.doctors}、有线索省份 ${output.totals.provinces_with_reports}`,
)
