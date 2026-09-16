'use client'

import { useMemo, useState } from 'react'
import { aggregateDoctorLeads } from '@/lib/doctor-leads'
import type { Hospital, Report } from '@/lib/schema'

/**
 * 地图侧栏「医生线索」面板。
 *
 * 聚合与关键词判定全部来自 lib/doctor-leads.ts（与 /doctors/ 页面共用同一函数），
 * 这里只负责搜索框、分组标题与结果列表的呈现。
 */
export function DoctorExplorer({ hospitals, reports, onSelectHospital }: {
  hospitals: Hospital[]
  reports: Report[]
  onSelectHospital: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const groups = useMemo(() => aggregateDoctorLeads(hospitals, reports, query), [hospitals, reports, query])

  return <div className="tc-doctor-explorer">
    <label className="tc-field">搜索医生
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="病症 / 医生 / 医院，可用空格组合" />
    </label>
    <p className="tc-meta">按关联线索的病症分组</p>
    {groups.length === 0 && <p className="tc-empty">没有匹配的医生线索</p>}
    {groups.map(group => <section key={group.id} className="tc-doctor-group">
      <h2>{group.label} <small>{group.leadCount}</small></h2>
      {group.entries.map(entry => <button key={`${entry.hospitalId}:${entry.name}`} type="button" className="tc-doctor-result" onClick={() => onSelectHospital(entry.hospitalId)}>
        <strong>{entry.name}</strong><small>{entry.hospitalName} · {entry.leadCount} 条线索</small>
      </button>)}
    </section>)}
  </div>
}
