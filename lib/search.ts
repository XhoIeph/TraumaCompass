import type { Hospital, Report } from './schema'

export function normalizeSearch(text: string): string {
  return text.toLowerCase().replace(/孤独症|自闭症|autism/gi, 'asd').replace(/复杂性创伤后应激障碍/g, 'cptsd').replace(/边缘型人格障碍/g, 'bpd')
}

export function matchesSearch(text: string, query: string): boolean {
  const haystack = normalizeSearch(text)
  const terms = normalizeSearch(query).split(/[\s,，、;；]+/u).filter(Boolean)
  return terms.every(term => haystack.includes(term))
}

export function hospitalSearchText(hospital: Hospital, reports: Report[]): string {
  const related = reports.filter(report => report.hospital_id === hospital.id)
  return normalizeSearch([
    hospital.name, ...hospital.aliases, hospital.province, hospital.city,
    ...hospital.departments, ...hospital.trauma_service.evidence,
    ...related.flatMap(report => [report.evidence_quote, report.evidence_full_text ?? '', report.doctor_name_raw ?? '', ...report.disorders]),
  ].join(' '))
}
