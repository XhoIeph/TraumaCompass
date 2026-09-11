import type { Disorder, Report } from '@/lib/schema'
import {
  EVIDENCE_SOURCE_LABELS,
  PLATFORM_LABELS,
  VERIFICATION_HINTS,
  VERIFICATION_LABELS,
  formatCost,
  formatPublishedAt,
  formatRegion,
} from '@/lib/format'

const STAGE_LABELS: Record<string, string> = {
  seeking: '求医中',
  consulted: '已就诊',
  assessed: '已做评估',
  diagnosed: '自称已确诊',
  treated: '已接受治疗',
  unknown: '阶段未知',
}

function verificationClass(level: Report['verification']['level']): string {
  if (level === 'official') return 'tc-badge tc-badge--official'
  if (level === 'corroborated') return 'tc-badge tc-badge--corroborated'
  return 'tc-badge tc-badge--unverified'
}

export function ReportCard({
  report,
  disorders,
  showHospital = true,
}: {
  report: Report
  disorders: Disorder[]
  showHospital?: boolean
}) {
  const disorderNames = report.disorders
    .map((id) => disorders.find((disorder) => disorder.id === id)?.name_zh ?? id)
    .join(' / ')
  const cost = formatCost(report.cost_cny)

  return (
    <article className="tc-report">
      <div className="tc-row tc-row--between">
        <div className="tc-row">
          <span className="tc-badge tc-badge--neutral">{PLATFORM_LABELS[report.platform]}</span>
          <span className={verificationClass(report.verification.level)}>
            {VERIFICATION_LABELS[report.verification.level]}
          </span>
          <span className="tc-badge tc-badge--accent">{disorderNames}</span>
          <span className="tc-badge tc-badge--neutral">{STAGE_LABELS[report.stage] ?? report.stage}</span>
        </div>
        <span className="tc-meta">{formatPublishedAt(report.published_at, report.published_at_precision)}</span>
      </div>

      <blockquote className="tc-quote">「{report.evidence_quote}」</blockquote>

      <div className="tc-row tc-meta">
        <span>{report.author_alias}</span>
        <span>·</span>
        <span>{formatRegion(report)}</span>
        {showHospital && (report.hospital_name_raw || report.department) && (
          <>
            <span>·</span>
            <span>
              {[report.hospital_name_raw, report.department].filter(Boolean).join(' ')}
              {report.hospital_id ? '' : '（未关联到机构条目）'}
            </span>
          </>
        )}
        {report.doctor_name_raw && (
          <>
            <span>·</span>
            <span>
              提及医生：{report.doctor_name_raw}
              {report.doctor_title_raw ? `（${report.doctor_title_raw}）` : ''}
            </span>
          </>
        )}
        {cost && (
          <>
            <span>·</span>
            <span>费用自述：{cost}</span>
          </>
        )}
      </div>

      <div className="tc-row tc-meta" style={{ marginTop: 'var(--tc-space-2)' }}>
        <span>摘录自{EVIDENCE_SOURCE_LABELS[report.evidence_source] ?? '原文'}</span>
        <span>·</span>
        <span>{VERIFICATION_HINTS[report.verification.level]}</span>
        <span>·</span>
        <a href={report.source_url} target="_blank" rel="nofollow noopener noreferrer">
          查看原帖 ↗
        </a>
      </div>
    </article>
  )
}
