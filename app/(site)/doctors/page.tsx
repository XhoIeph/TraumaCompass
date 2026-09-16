'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { DOCTOR_LEAD_SOURCE_NOTE, aggregateDoctorLeads, type DoctorLead } from '@/lib/doctor-leads'
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
      <div className="tc-stack">
        <h1>医生线索</h1>
        <p className="tc-muted">
          汇总公开就诊线索原文里提到的医生姓名，按关联线索的病症分组展示，便于按地区与机构继续查找。
        </p>
        <p className="tc-badge tc-badge--accent" style={{ display: 'inline-block', whiteSpace: 'normal' }}>
          {DOCTOR_LEAD_SOURCE_NOTE}
        </p>
      </div>

      <div className="tc-card">
        <h2>公开执业信息条目</h2>
        {doctors.length === 0 ? (
          <div className="tc-empty">
            <p>暂无公开执业信息条目。</p>
            <p className="tc-small tc-faint">
              这一区块只在拿到医院官网或国家卫健委执业注册信息查询等公开来源后逐条建立，
              与上面的网友线索不是同一层依据，因此不混在一起展示。
            </p>
          </div>
        ) : (
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
        )}
      </div>

      <DoctorLeadExplorer />
    </div>
  )
}

/**
 * 医生线索的搜索与分组结果（客户端交互部分）。
 * 复用地图侧栏的聚合逻辑；点医生姓名 / 机构名都会定位到机构详情页，
 * 在那里能看到包含该医生姓名的相关线索。
 */
function DoctorLeadExplorer() {
  const [query, setQuery] = useState('')
  const groups = useMemo(
    () => aggregateDoctorLeads(hospitals, publicReports, query),
    [query],
  )
  const leadTotal = groups.reduce((sum, group) => sum + group.leadCount, 0)
  const hospitalTotal = new Set(groups.flatMap((group) => group.entries.map((entry) => entry.hospitalId))).size

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
        <p className="tc-small tc-muted" style={{ margin: 0 }}>
          空格、逗号、顿号或分号分隔多个关键词，需同时命中。
        </p>
        <button type="button" className="tc-button" onClick={() => setQuery('')} disabled={query.trim() === ''}>
          重置
        </button>
      </form>

      <p className="tc-small tc-muted">
        {leadTotal} 条医生线索 · 涉及 {hospitalTotal} 家机构 · 按关联线索的病症分组
      </p>

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
                  <DoctorLeadCard key={`${group.id}:${entry.hospitalId}:${entry.name}`} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function DoctorLeadCard({ entry }: { entry: DoctorLead }) {
  const region = entry.city && entry.city !== entry.province ? `${entry.province} · ${entry.city}` : entry.province
  const disorders = entry.disorders.map((id) => (id === 'other' ? '其他' : id.toUpperCase())).join(' / ')

  return (
    <div className="tc-card">
      <h3 style={{ marginBottom: 4 }}>{entry.name}</h3>
      <div className="tc-row tc-meta">
        <span>{region}</span>
        <span>·</span>
        <Link href={`/hospitals/${entry.hospitalId}/`}>{entry.hospitalName}</Link>
      </div>
      <p className="tc-meta" style={{ marginTop: 8 }}>
        医生线索 · {entry.hospitalName} · 关联病症 {disorders} · 线索 {entry.leadCount} 条
      </p>
      <p className="tc-small" style={{ marginBottom: 0 }}>
        <Link href={`/hospitals/${entry.hospitalId}/`}>查看机构与相关线索 →</Link>
      </p>
    </div>
  )
}
