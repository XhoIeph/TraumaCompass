'use client'

import Link from 'next/link'
import { formatReportSource } from '@/lib/format'
import type { DoctorLead } from '@/lib/doctor-leads'
import type { Report } from '@/lib/schema'

export function DoctorLeadItem({ entry, reports, onSelectHospital }: {
  entry: DoctorLead
  reports: Report[]
  onSelectHospital?: (id: string) => void
}) {
  const related = reports.filter((report) => entry.reportIds.includes(report.id))
  const hospitalId = entry.hospitalId

  return (
    <details className="tc-doctor-result">
      <summary>
        <strong>{entry.name}</strong>
        <small>{entry.hospitalName} · {entry.leadCount} 条线索</small>
      </summary>
      <div className="tc-doctor-result-body">
        {related.map((report) => (
          <div key={report.id} className="tc-doctor-evidence">
            <p className="tc-small tc-muted">
              来源：<a href={report.source_url} target="_blank" rel="nofollow noopener noreferrer">{formatReportSource(report)} ↗</a>
            </p>
            <blockquote>「{report.evidence_quote}」</blockquote>
            {report.evidence_full_text && report.evidence_full_text !== report.evidence_quote && (
              <details>
                <summary>展开原文</summary>
                <blockquote>{report.evidence_full_text}</blockquote>
              </details>
            )}
          </div>
        ))}
        {onSelectHospital && hospitalId ? (
          <button type="button" className="tc-linklike" onClick={() => onSelectHospital(hospitalId)}>在地图查看机构</button>
        ) : hospitalId ? (
          <Link href={`/hospitals/${hospitalId}/`}>查看机构 →</Link>
        ) : null}
      </div>
    </details>
  )
}
