import type { Disorder, Doctor, Hospital, Province, ProvinceStats, Report } from './schema'
import { matchProvinceAdcode } from './region'

import disordersFile from '@/data/curated/disorders.json'
import doctorsFile from '@/data/curated/doctors.json'
import hospitalsFile from '@/data/curated/hospitals.json'
import provincesFile from '@/data/curated/provinces.json'
import reportsFile from '@/data/curated/reports.json'
import statsFile from '@/data/generated/province-stats.json'

/**
 * 构建期装载（静态导出：所有数据在 build 时读入并预渲染）。
 * `npm run data:validate` 会在 prebuild 阶段用 zod 校验这些文件，
 * 因此这里只做类型断言，避免把 zod 打进前端包。
 */
export const provinces = provincesFile.items as unknown as Province[]
export const disorders = disordersFile.items as unknown as Disorder[]
export const hospitals = hospitalsFile.items as unknown as Hospital[]
export const doctors = doctorsFile.items as unknown as Doctor[]
export const reports = reportsFile.items as unknown as Report[]
export const provinceStats = statsFile as unknown as ProvinceStats

export const visibleDisorders = disorders.filter((disorder) => disorder.visible)

/** 只有 published 状态的线索才会出现在公开站点上 */
export const publicReports = reports.filter((report) => report.status === 'published')

export function provinceByAdcode(adcode: string): Province | undefined {
  return provinces.find((province) => province.adcode === adcode)
}

export function hospitalById(id: string): Hospital | undefined {
  return hospitals.find((hospital) => hospital.id === id)
}

export function doctorById(id: string): Doctor | undefined {
  return doctors.find((doctor) => doctor.id === id)
}

export function disorderById(id: string): Disorder | undefined {
  return disorders.find((disorder) => disorder.id === id)
}

export function reportsForHospital(hospitalId: string): Report[] {
  return publicReports.filter((report) => report.hospital_id === hospitalId)
}

export function doctorsForHospital(hospitalId: string): Doctor[] {
  return doctors.filter((doctor) => doctor.hospital_id === hospitalId)
}

export function statsForAdcode(adcode: string) {
  return provinceStats.items.find((item) => item.adcode === adcode)
}

/** 线索归属省份：与 scripts/build-aggregates.ts 使用同一套匹配规则 */
export function reportProvinceAdcode(report: Report): string | undefined {
  if (report.hospital_id) {
    const hospital = hospitalById(report.hospital_id)
    if (hospital) return hospital.adcode
  }
  // 只用「作者自述所在地」与「医院所在地」；平台 IP 属地不采集
  return matchProvinceAdcode([report.self_reported_region, report.hospital_region], provinces)
}

/** report id → adcode，供客户端筛选使用（静态导出下筛选必须在浏览器里做） */
export function reportProvinceMap(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const report of publicReports) {
    const adcode = reportProvinceAdcode(report)
    if (adcode) map[report.id] = adcode
  }
  return map
}
