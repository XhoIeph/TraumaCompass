'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DoctorLeadItem } from '@/components/DoctorLeadItem'
import { aggregateDoctorLeads } from '@/lib/doctor-leads'
import { doctors, hospitalById, hospitals, publicReports } from '@/lib/data'

/**
 * 「医生线索」页。
 *
 * 与地图侧栏共用 lib/doctor-leads.ts 的 aggregateDoctorLeads，避免两处分别计算而漂移。
 * 页面按 CPTSD / BPD / OSDD / DID / PTSD / 其他 分组，并提供与侧栏同样的多关键词搜索。
 * 结构化执业信息（lib/data.ts 的 doctors）单独成区块，不与网友线索混为同一层。
 */
export default function DoctorsPage() {
  return (
    <div className="tc-stack" style={{ gap: 'var(--tc-space-4)' }}>
      <header className="tc-page-heading">
        <div>
          <h1>医生线索</h1>
          <p className="tc-muted">按病症查找原帖中提到的医生；展开条目可看对应线索。</p>
        </div>
      </header>

      <DoctorLeadExplorer />

      {doctors.length > 0 && (
        <details className="tc-card tc-secondary-section">
          <summary>公开执业信息条目（{doctors.length}）</summary>
          <div className="tc-grid tc-grid--cards">
            {doctors.map((doctor) => {
              const hospital = hospitalById(doctor.hospital_id)
              return (
                <div className="tc-card" key={doctor.id}>
                  <h3 style={{ marginBottom: 4 }}>
                    <Link href={`/doctors/${doctor.id}/`}>{doctor.name}</Link>
                  </h3>
                  <p className="tc-small tc-muted" style={{ margin: 0 }}>
                    {doctor.title} · {doctor.department}
                    {hospital ? ` · ${hospital.name}` : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}

/**
 * 医生线索的搜索与分组结果（客户端交互部分）。
 * 复用地图侧栏的聚合逻辑；展开每位医生可查看关联线索，再进入机构详情页。
 */
function DoctorLeadExplorer() {
  const [query, setQuery] = useState('')
  const groups = useMemo(
    () => aggregateDoctorLeads(hospitals, publicReports, query),
    [query],
  )

  return (
    <div className="tc-doctor-explorer tc-doctor-explorer--page">
      <form className="tc-card tc-filters" onSubmit={(event) => event.preventDefault()}>
        <label className="tc-field">
          搜索医生线索
          <input
            type="search"
            value={query}
            placeholder="病症 / 医生 / 医院 / 省份，可用空格组合"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button type="button" className="tc-button" onClick={() => setQuery('')} disabled={query.trim() === ''}>
          重置
        </button>
      </form>

      {groups.length === 0 ? (
        <div className="tc-empty">
          <p>没有匹配的医生线索。</p>
          <p className="tc-small tc-faint">
            可以换用医生姓名、机构名、省份或病症（如 CPTSD、BPD）等关键词。
          </p>
          <p className="tc-small">
            <Link href="/reports/">先看就诊线索列表 →</Link>
          </p>
        </div>
      ) : (
        <div className="tc-stack">
          {groups.map((group) => (
            <section key={group.id} className="tc-doctor-group">
              <h2>
                {group.label} <small>{group.leadCount}</small>
              </h2>
              <div className="tc-grid tc-grid--cards">
                {group.entries.map((entry) => (
                  <DoctorLeadItem key={`${group.id}:${entry.hospitalId ?? entry.hospitalName}:${entry.name}`} entry={entry} reports={publicReports} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
