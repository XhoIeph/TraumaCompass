'use client'

import Link from 'next/link'
import { PLATFORM_LABELS } from '@/lib/format'
import type { MapHospital, MapLead } from './types'
import { STAGE_LABELS } from './types'

/** 侧栏中的医院详情卡：由点击地图节点 / 搜索 / 机构列表触发 */
export function HospitalDetail({
  hospital,
  leads,
  onClose,
  onLocate,
}: {
  hospital: MapHospital
  leads: MapLead[]
  onClose: () => void
  onLocate: () => void
}) {
  return (
    <div className="tc-stack">
      <div className="tc-row tc-row--between">
        <h2 style={{ marginBottom: 0, fontSize: '1.05rem' }}>{hospital.name}</h2>
        <button type="button" className="tc-button" onClick={onClose} aria-label="关闭详情">
          关闭
        </button>
      </div>
      <p className="tc-small tc-muted" style={{ margin: 0 }}>
        {hospital.province}
        {hospital.city && hospital.city !== hospital.province ? ` · ${hospital.city}` : ''} ·{' '}
        {hospital.category} · {hospital.level === '未知' ? '等级未标注' : hospital.level}
      </p>
      <div className="tc-row tc-small">
        <span className="tc-badge tc-badge--accent">线索 {hospital.leads} 条</span>
        {hospital.evidenceCount > 0 && (
          <span className="tc-badge tc-badge--neutral">来源 {hospital.evidenceCount} 条</span>
        )}
      </div>
      {hospital.doctors.length > 0 && (
        <p className="tc-small" style={{ margin: 0 }}>
          提及医生：{hospital.doctors.join('、')}
        </p>
      )}
      <div className="tc-hospital-actions">
        <button type="button" className="tc-button" onClick={onLocate}>
          在地图上定位
        </button>

        <Link className="tc-button" href={`/hospitals/${hospital.id}/`}>医院详细信息 →</Link>
      </div>
      <hr className="tc-divider" />
      <h3 style={{ marginBottom: 0 }}>就诊线索（{leads.length}）</h3>
      {leads.length === 0 ? (
        <p className="tc-small tc-faint" style={{ margin: 0 }}>
          暂无关联线索。
        </p>
      ) : (
        leads.map((lead) => (
          <article key={lead.id} className="tc-report" style={{ padding: 'var(--tc-space-2)' }}>
            <div className="tc-row tc-meta">
              <span>{PLATFORM_LABELS[lead.platform as keyof typeof PLATFORM_LABELS] ?? lead.platform}</span>
              {lead.publishedAt && <span>· {lead.publishedAt}</span>}
              {lead.doctor && <span>· 医生：{lead.doctor}</span>}
              <span>· {STAGE_LABELS[lead.stage] ?? lead.stage}</span>
            </div>
            {lead.contextNote && (
              <p className="tc-small tc-muted" style={{ margin: '4px 0' }}>
                {lead.contextNote}
              </p>
            )}
            <blockquote className="tc-quote" style={{ margin: '6px 0' }}>
              「{lead.quote}」
            </blockquote>
            <a className="tc-small" href={lead.url} target="_blank" rel="nofollow noopener noreferrer">
              查看原帖 ↗
            </a>
          </article>
        ))
      )}
    </div>
  )
}
