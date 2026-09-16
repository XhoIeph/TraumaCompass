import type { DisorderId, Hospital, Report } from './schema'
import { matchesSearch } from './search'

/**
 * 医生线索聚合（单一事实源）
 *
 * 地图侧栏（components/map/DoctorExplorer.tsx）与独立页（app/(site)/doctors/page.tsx）
 * 共用本文件，避免两处各算一套而漂移。
 *
 * 口径：
 * - 这里的「医生」只来自公开就诊线索原文里的 `report.doctor_name_raw`，
 *   不代表执业资格核验、服务保证或推荐；姓名按原文呈现，不做任何规范化改写。
 * - 同一医生在同一机构合并计数（不同线索重复出现只计一次）。
 * - 纯函数、无副作用、不依赖浏览器 API。
 */

/** 分组展示顺序：cptsd, bpd, osdd, did, ptsd, other */
export const DOCTOR_LEAD_DISORDER_ORDER: readonly DisorderId[] = [
  'cptsd',
  'bpd',
  'osdd',
  'did',
  'ptsd',
  'other',
]

/** 分组标题（other 显示「其他」，其余用大写 ID，与地图侧栏一致） */
export const DOCTOR_LEAD_DISORDER_LABELS: Record<DisorderId, string> = {
  cptsd: 'CPTSD',
  bpd: 'BPD',
  osdd: 'OSDD',
  did: 'DID',
  ptsd: 'PTSD',
  other: '其他',
}

/** 同一条线索里多条医生姓名的分隔符 */
const DOCTOR_NAME_SEPARATOR = /[、,，/]/

/** 组织：一家机构的线索分组 */
export type DoctorLeadGroup = {
  id: DisorderId
  /** 分组标题，如 CPTSD / 其他 */
  label: string
  /** 该组内合并后的医生线索 */
  entries: DoctorLead[]
  /** 该组内医生线索条数（= entries.length，供标题角标使用） */
  leadCount: number
  /** 该组涉及的去重线索总数 */
  reportCount: number
}

/** 单条医生线索：一位医生在一家机构的全部线索 */
export type DoctorLead = {
  /** 医生姓名，原文拆分为单个姓名后 trim */
  name: string
  hospitalId: string
  hospitalName: string
  province: string
  city: string
  /** 该医生关联线索覆盖的病症（按固定顺序去重） */
  disorders: DisorderId[]
  /** 合并后的线索条数 */
  reportIds: string[]
  leadCount: number
}

export type DoctorLeadIndex = {
  /** `${hospitalId}:${doctorName}` → 线索 */
  leads: Map<string, DoctorLead>
  /** `${hospitalId}:${doctorName}:${disorderId}` → 线索（按病症切分） */
  entries: Map<string, DoctorLead>
}

/** 页面与地图共用的一句说明，避免两处文案漂移 */
export const DOCTOR_LEAD_SOURCE_NOTE =
  '姓名来自公开就诊线索原文，不代表执业资格核验、服务保证或推荐。'

function isDisorderId(value: string): value is DisorderId {
  return (DOCTOR_LEAD_DISORDER_ORDER as readonly string[]).includes(value)
}

function disorderRank(id: DisorderId): number {
  const index = DOCTOR_LEAD_DISORDER_ORDER.indexOf(id)
  return index === -1 ? DOCTOR_LEAD_DISORDER_ORDER.length : index
}

/** 线索所属病症：无病症或缺省时归入 other，未知值同样归入 other */
function disordersOf(report: Report): DisorderId[] {
  const ids = (report.disorders ?? []).filter(isDisorderId)
  return ids.length ? ids : ['other']
}

/** 按 `[、,，/]` 拆分 `doctor_name_raw`，trim 后去空、去重（同名只保留首次出现） */
export function splitDoctorNames(raw: string | undefined | null): string[] {
  if (!raw) return []
  const names: string[] = []
  for (const part of raw.split(DOCTOR_NAME_SEPARATOR)) {
    const name = part.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

/** 医生线索的检索文本：医生 / 机构 / 省市 / 病症 / 线索摘录（可用空格、逗号、顿号、分号 AND 组合） */
export function doctorLeadSearchText(lead: DoctorLead, reports: Report[]): string {
  const related = reports.filter((report) => lead.reportIds.includes(report.id))
  const quotes = related.flatMap((report) => [
    report.evidence_quote,
    report.evidence_full_text ?? '',
    report.doctor_name_raw ?? '',
  ])
  // hospitalId 也纳入检索文本：报告里的 doctor_name_raw 经常省略姓氏以外的信息，
  // 而机构 id（如 sc-wcsh）是两个消费方唯一都持有的稳定标识。
  return [lead.hospitalId, lead.name, lead.hospitalName, lead.province, lead.city, ...lead.disorders, ...quotes].join(' ')
}

/** 判断单条医生线索是否命中关键词（与地图侧栏、独立页共用同一判定） */
export function matchesDoctorLead(lead: DoctorLead, query: string | undefined, reports: Report[]): boolean {
  if (!query || !query.trim()) return true
  return matchesSearch(doctorLeadSearchText(lead, reports), query)
}

function compareLeads(a: DoctorLead, b: DoctorLead): number {
  return (
    b.leadCount - a.leadCount ||
    a.name.localeCompare(b.name, 'zh-Hans-CN') ||
    a.hospitalName.localeCompare(b.hospitalName, 'zh-Hans-CN')
  )
}

/**
 * 建立索引：与查询无关，可按机构 / 医生 / 病症直接取。
 * 只处理能在 `hospitals` 中找到机构的线索，且只处理 `doctor_name_raw` 非空的线索。
 */
export function buildDoctorLeadIndex(hospitals: Hospital[], reports: Report[]): DoctorLeadIndex {
  const hospitalById = new Map(hospitals.map((hospital) => [hospital.id, hospital]))
  const leads = new Map<string, DoctorLead>()
  const entries = new Map<string, DoctorLead>()

  /** 合并计数：同一医生在同一机构 / 同一病症下重复出现时只累加一次线索 */
  const touch = (map: Map<string, DoctorLead>, key: string, lead: DoctorLead, reportId: string) => {
    const existing = map.get(key)
    if (!existing) {
      map.set(key, lead)
      return
    }
    if (!existing.reportIds.includes(reportId)) existing.reportIds.push(reportId)
    existing.leadCount = existing.reportIds.length
  }

  /** 每条 (机构, 医生, 病症) 组合的初始线索，后续只累加 reportIds */
  const makeLead = (hospital: Hospital, name: string, disorders: DisorderId[], reportId: string): DoctorLead => ({
    name,
    hospitalId: hospital.id,
    hospitalName: hospital.name,
    province: hospital.province,
    city: hospital.city,
    disorders,
    reportIds: [reportId],
    leadCount: 1,
  })

  for (const report of reports) {
    if (!report.hospital_id || !report.doctor_name_raw) continue
    const hospital = hospitalById.get(report.hospital_id)
    if (!hospital) continue
    const disorders = disordersOf(report)
    for (const name of splitDoctorNames(report.doctor_name_raw)) {
      const base = `${hospital.id}:${name}`
      touch(leads, base, makeLead(hospital, name, [], report.id), report.id)

      const merged = leads.get(base)!
      for (const disorder of disorders) {
        if (!merged.disorders.includes(disorder)) merged.disorders.push(disorder)
        touch(entries, `${base}:${disorder}`, makeLead(hospital, name, [disorder], report.id), report.id)
      }
    }
  }

  for (const lead of leads.values()) {
    lead.disorders.sort((a, b) => disorderRank(a) - disorderRank(b))
  }

  return { leads, entries }
}

/**
 * 按病症分组输出医生线索。
 *
 * @param hospitals 机构数据（用于把 `report.hospital_id` 解析为机构、省份、城市）
 * @param reports 线索数据（公开线索；机构缺失或医生姓名缺失的线索会被跳过）
 * @param query 多关键词，空格 / 逗号 / 顿号 / 分号分隔，AND 逻辑；可匹配医生姓名、
 *              机构名、省份、城市、病症 ID、线索摘录
 * @returns 非空分组，顺序固定为 cptsd, bpd, osdd, did, ptsd, other
 */
export function aggregateDoctorLeads(
  hospitals: Hospital[],
  reports: Report[],
  query = '',
): DoctorLeadGroup[] {
  const { entries } = buildDoctorLeadIndex(hospitals, reports)
  const buckets = new Map<DisorderId, DoctorLead[]>()

  for (const entry of entries.values()) {
    const disorder = entry.disorders[0]
    const bucket = buckets.get(disorder)
    if (bucket) bucket.push(entry)
    else buckets.set(disorder, [entry])
  }

  return DOCTOR_LEAD_DISORDER_ORDER.filter((id) => buckets.has(id))
    .map((id) => {
      const matched = buckets
        .get(id)!
        .filter((lead) => matchesDoctorLead(lead, query, reports))
        .map((lead) => ({ ...lead, disorders: [...lead.disorders], reportIds: [...lead.reportIds] }))
        .sort(compareLeads)
      return {
        id,
        label: DOCTOR_LEAD_DISORDER_LABELS[id],
        entries: matched,
        leadCount: matched.length,
        reportCount: new Set(matched.flatMap((lead) => lead.reportIds)).size,
      }
    })
    .filter((group) => group.entries.length > 0)
}

/** 便捷封装：一次性拿到分组与索引（索引可按机构 / 医生直接取，无需再次过滤） */
export function buildDoctorLeads(hospitals: Hospital[], reports: Report[], query = '') {
  return {
    groups: aggregateDoctorLeads(hospitals, reports, query),
    index: buildDoctorLeadIndex(hospitals, reports),
    query,
  }
}
