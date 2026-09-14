'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { Hospital, Province, Report } from '@/lib/schema'

import { hospitalSearchText, matchesSearch } from '@/lib/search'

const SERVICE_LABELS: Record<string, string> = {
  yes: '有明确依据',
  claimed: '有间接证据',
  unknown: '未知',
  no: '无',
}

type Props = {
  hospitals: Hospital[]
  reports?: Report[]
  provinces: Province[]
  reportCounts: Record<string, number>
  /** compact：适配侧边栏窄面板的筛选与卡片布局（默认 page 不变） */
  variant?: 'page' | 'compact'
  /** 提供时每张机构卡出现「在地图上查看」按钮（首页地图侧栏联动） */
  onSelectHospital?: (id: string) => void
}

export function HospitalExplorer({
  hospitals,
  reports = [],
  provinces,
  reportCounts,
  variant = 'page',
  onSelectHospital,
}: Props) {
  const searchParams = useSearchParams()
  const [province, setProvince] = useState(() => searchParams.get('province') ?? '')
  const [category, setCategory] = useState('')
  const [onlyEvidence, setOnlyEvidence] = useState(false)
  const [keyword, setKeyword] = useState('')

  const categories = useMemo(
    () => [...new Set(hospitals.map((hospital) => hospital.category))].sort(),
    [hospitals],
  )

  const filtered = useMemo(() => {
    const needle = keyword.trim()
    return hospitals.filter((hospital) => {
      if (province && hospital.adcode !== province) return false
      if (category && hospital.category !== category) return false
      if (onlyEvidence) {
        const service = hospital.trauma_service
        const hasEvidence =
          service.evidence.length > 0 ||
          service.cptsd_assessment === 'yes' ||
          service.cptsd_bpd_diagnosis === 'yes'
        if (!hasEvidence) return false
      }
      if (needle) {
        const haystack = hospitalSearchText(hospital, reports)
        if (!matchesSearch(haystack, needle)) return false
      }
      return true
    })
  }, [category, hospitals, reports, keyword, onlyEvidence, province])

  return (
    <div>
      <form
        className={`tc-card tc-filters${variant === 'compact' ? ' tc-filters--compact' : ''}`}
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="tc-field">
          省份
          <select value={province} onChange={(event) => setProvince(event.target.value)}>
            <option value="">全部</option>
            {provinces.map((item) => (
              <option key={item.adcode} value={item.adcode}>
                {item.short_name}
              </option>
            ))}
          </select>
        </label>

        <label className="tc-field">
          机构类型
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">全部</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>

        <label className="tc-field">
          关键词
          <input
            type="search"
            value={keyword}
            placeholder="医院 / 疾病 / 医生 / 科室"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>

        <label className="tc-row tc-small" style={{ gap: 6 }}>
          <input
            type="checkbox"
            checked={onlyEvidence}
            onChange={(event) => setOnlyEvidence(event.target.checked)}
          />
          只看有创伤服务证据的机构
        </label>
      </form>

      <p className="tc-small tc-muted">
        {filtered.length} 家机构
      </p>

      {filtered.length === 0 ? (
        <div className="tc-empty">
          <p>没有符合筛选条件的机构记录。</p>
        </div>
      ) : (
        <div className={`tc-grid tc-grid--cards${variant === 'compact' ? ' tc-grid--compact' : ''}`}>
          {filtered.map((hospital) => (
            <div className="tc-card" key={hospital.id}>
              <h2 style={{ marginBottom: 4 }}>
                {onSelectHospital ? <button type="button" className="tc-linklike" onClick={() => onSelectHospital(hospital.id)}>{hospital.name}</button> : <Link href={`/hospitals/${hospital.id}/`}>{hospital.name}</Link>}
              </h2>
              <div className="tc-row tc-meta">
                <span>{hospital.province}{hospital.city === hospital.province ? '' : ` · ${hospital.city}`}</span>
                <span>·</span>
                <span>{hospital.level}</span>
                <span>·</span>
                <span>{hospital.category}</span>
              </div>
              <p className="tc-small tc-muted" style={{ margin: '8px 0 4px' }}>
                科室：{hospital.departments.join('、')}
              </p>
              <div className="tc-row tc-small">
                <span className="tc-badge tc-badge--neutral">
                  CPTSD 评估：{SERVICE_LABELS[hospital.trauma_service.cptsd_assessment]}
                </span>
                <span className="tc-badge tc-badge--neutral">
                  CPTSD/BPD 诊断：{SERVICE_LABELS[hospital.trauma_service.cptsd_bpd_diagnosis]}
                </span>
              </div>
              <p className="tc-meta" style={{ marginTop: 8 }}>
                关联线索 {reportCounts[hospital.id] ?? 0} 条 · 官方来源 {hospital.official_sources.length} 个
              </p>
              {onSelectHospital && (
                <button
                  type="button"
                  className="tc-button"
                  style={{ marginTop: 'var(--tc-space-2)' }}
                  onClick={() => onSelectHospital(hospital.id)}
                >
                  在地图上查看
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
