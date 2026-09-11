/**
 * 数据体检：打印当前数据集规模、平台分布与省级覆盖，供采集前后对照。
 */
import type { Disorder, Doctor, Hospital, Province, ProvinceStats, Report } from '../lib/schema.ts'
import { CURATED_FILES, GENERATED_DIR, readJson } from './lib/paths.ts'
import { resolve } from 'node:path'

const disorders = readJson<{ items: Disorder[] }>(CURATED_FILES.disorders).items
const provinces = readJson<{ items: Province[] }>(CURATED_FILES.provinces).items
const hospitals = readJson<{ items: Hospital[] }>(CURATED_FILES.hospitals).items
const doctors = readJson<{ items: Doctor[] }>(CURATED_FILES.doctors).items
const reports = readJson<{ items: Report[] }>(CURATED_FILES.reports).items
const stats = readJson<ProvinceStats>(resolve(GENERATED_DIR, 'province-stats.json'))

const published = reports.filter((report) => report.status === 'published')

console.log('TraumaCompass 数据体检')
console.log('='.repeat(46))
console.log(
  `疾病条目      ${disorders.length} 个（对外可见 ${disorders.filter((d) => d.visible).length} 个，编码待核对 ${disorders.filter((d) => d.code_review_status === 'pending_review').length} 个）`,
)
console.log(`医院          ${hospitals.length} 家，覆盖 ${new Set(hospitals.map((h) => h.adcode)).size} 个省级行政区`)
console.log(`医生          ${doctors.length} 位`)
console.log(
  `线索          ${reports.length} 条（已发布 ${published.length}、保留 ${reports.length - published.length}、未定位省份 ${stats.totals.reports_unlocated}）`,
)

const byPlatform = new Map<string, number>()
for (const report of published) byPlatform.set(report.platform, (byPlatform.get(report.platform) ?? 0) + 1)
console.log('\n平台分布（已发布）')
for (const [platform, count] of [...byPlatform].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${platform.padEnd(12)} ${count}`)
}

const byLevel = new Map<string, number>()
for (const report of published) {
  byLevel.set(report.verification.level, (byLevel.get(report.verification.level) ?? 0) + 1)
}
console.log('\n核验等级（已发布）')
for (const [level, count] of byLevel) console.log(`  ${level.padEnd(12)} ${count}`)

const covered = stats.items.filter((item) => item.reports_total > 0 || item.hospitals_total > 0)
console.log(`\n省级覆盖      ${covered.length} / ${provinces.length}`)
const gaps = provinces.filter(
  (province) =>
    !stats.items.find((item) => item.adcode === province.adcode && (item.reports_total > 0 || item.hospitals_total > 0)),
)
if (gaps.length > 0) {
  console.log(`  暂无记录：${gaps.map((province) => province.short_name).join('、')}`)
}
