'use client'

import { useMemo, useState } from 'react'
import type { Hospital, Report } from '@/lib/schema'
import { matchesSearch } from '@/lib/search'

export function DoctorExplorer({ hospitals, reports, onSelectHospital }: {
  hospitals: Hospital[]
  reports: Report[]
  onSelectHospital: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => {
    const result = new Map<string, Map<string, { name: string; hospital: Hospital; reports: Report[] }>>()
    for (const report of reports) {
      const hospital = hospitals.find(h => h.id === report.hospital_id)
      if (!hospital || !report.doctor_name_raw) continue
      for (const disorder of report.disorders.length ? report.disorders : ['other']) {
        if (!result.has(disorder)) result.set(disorder, new Map())
        const group = result.get(disorder)!
        for (const name of report.doctor_name_raw.split(/[、,，/]/).map(n => n.trim()).filter(Boolean)) {
          const key = `${hospital.id}:${name}`
          if (!group.has(key)) group.set(key, { name, hospital, reports: [] })
          group.get(key)!.reports.push(report)
        }
      }
    }
    return [...result].map(([id, entries]) => ({
      id,
      entries: [...entries.values()].filter(entry => matchesSearch([
        id, entry.name, entry.hospital.name, entry.hospital.province,
        ...entry.reports.map(r => r.evidence_quote),
      ].join(' '), query)),
    })).filter(group => group.entries.length).sort((a, b) => {
      const order = ['cptsd', 'bpd', 'osdd', 'did', 'ptsd', 'other']
      return order.indexOf(a.id) - order.indexOf(b.id)
    })
  }, [hospitals, reports, query])

  return <div className="tc-doctor-explorer">
    <label className="tc-field">搜索医生
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="病症 / 医生 / 医院，可用空格组合" />
    </label>
    <p className="tc-meta">按关联线索的病症分组</p>
    {groups.length === 0 && <p className="tc-empty">没有匹配的医生线索</p>}
    {groups.map(group => <section key={group.id} className="tc-doctor-group">
      <h2>{group.id === 'other' ? '其他' : group.id.toUpperCase()} <small>{group.entries.length}</small></h2>
      {group.entries.map(entry => <button key={`${entry.hospital.id}:${entry.name}`} type="button" className="tc-doctor-result" onClick={() => onSelectHospital(entry.hospital.id)}>
        <strong>{entry.name}</strong><small>{entry.hospital.name} · {entry.reports.length} 条线索</small>
      </button>)}
    </section>)}
  </div>
}
