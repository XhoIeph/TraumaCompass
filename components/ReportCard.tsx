import type { Disorder, Report } from '@/lib/schema'
import {
  EVIDENCE_SOURCE_LABELS,
  PLATFORM_LABELS,
  formatCost,
  formatPublishedAt,
  formatRegion,
} from '@/lib/format'

/**
 * 线索卡片。设计原则（2026-09-11 按项目所有者要求调整）：
 * - 不显示任何「未核实 / 未经核实」标签 —— 网友自述无法核实，也不应要求核实；
 * - 不显示用户名、不显示 IP 属地；只给出来源平台、原帖链接与时间，读者可自行核对；
 * - 先显示上下文（父评论 / 所在帖子），再显示摘录。
 */

const STAGE_LABELS: Record<string, string> = {
  seeking: '求医中',
  consulted: '已就诊',
  assessed: '已做评估',
  diagnosed: '自称已确诊',
  treated: '已接受治疗',
  unknown: '阶段未知',
}

export function ReportCard({
  report,
  disorders,
  showHospital = true,
  onSelectHospital,
}: {
  report: Report
  disorders: Disorder[]
  showHospital?: boolean
  onSelectHospital?: (id: string) => void
}) {
  const disorderNames = report.disorders
    .map((id) => id === 'other' ? '其他' : id.toUpperCase())
    .join(' / ')
  const cost = formatCost(report.cost_cny)

  return (
    <article className="tc-report">
      <div className="tc-row tc-row--between">
        <div className="tc-row">
          <span className="tc-badge tc-badge--neutral">{PLATFORM_LABELS[report.platform]}</span>
          <span className="tc-badge tc-badge--accent">{disorderNames}</span>
          <span className="tc-badge tc-badge--neutral">{STAGE_LABELS[report.stage] ?? report.stage}</span>
          {report.context_incomplete && (
            <span className="tc-badge tc-badge--neutral" title="抓取时未能取到父评论或所在帖子信息">
              上下文不完整
            </span>
          )}
        </div>
        <span className="tc-meta">{formatPublishedAt(report.published_at, report.published_at_precision)}</span>
      </div>

      {/* 上下文优先于摘录展示：评论脱离父评论极易被误读 */}
      {report.evidence_context?.parent_excerpt && (
        <p className="tc-small tc-muted" style={{ margin: '0 0 4px' }}>
          该评论回复的原话：
          <span className="tc-quote" style={{ display: 'inline-block', borderLeft: 0, padding: 0 }}>
            「{report.evidence_context.parent_excerpt}」
          </span>
        </p>
      )}
      {!report.evidence_context?.parent_excerpt && report.evidence_source === 'comment' && (
        <p className="tc-small tc-faint" style={{ margin: '0 0 4px' }}>
          来源：{report.evidence_context?.note_title ? `《${report.evidence_context.note_title}》的评论区` : '评论区'}
          {report.evidence_context?.index_in_capture ? `（${report.evidence_context.index_in_capture}）` : ''}
        </p>
      )}

      <blockquote className="tc-quote">「{report.evidence_quote}」</blockquote>

      {report.evidence_full_text && report.evidence_full_text.length > report.evidence_quote.length && (
        <details className="tc-small" style={{ marginBottom: 'var(--tc-space-2)' }}>
          <summary className="tc-muted" style={{ cursor: 'pointer' }}>
            展开原文完整片段（{report.evidence_full_text.length} 字）
          </summary>
          <p className="tc-quote" style={{ marginTop: 'var(--tc-space-2)' }}>
            {report.evidence_full_text}
          </p>
        </details>
      )}

      <div className="tc-row tc-meta">
        <span>{formatRegion(report)}</span>
        {showHospital && (report.hospital_name_raw || report.department) && (
          <>
            <span>·</span>
            <span>{[report.hospital_name_raw, report.department].filter(Boolean).join(' ')}</span>
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
        {onSelectHospital && report.hospital_id && (
          <button type="button" className="tc-linklike" onClick={() => onSelectHospital(report.hospital_id!)}>查看机构</button>
        )}
        <span>摘录自{EVIDENCE_SOURCE_LABELS[report.evidence_source] ?? '原文'}</span>
        <span>·</span>
        <a href={report.source_url} target="_blank" rel="nofollow noopener noreferrer">
          查看原帖 ↗
        </a>
      </div>
    </article>
  )
}
