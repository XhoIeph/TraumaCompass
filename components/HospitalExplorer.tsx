'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import type { Hospital, Province, Report } from '@/lib/schema'

import { hospitalSearchText, matchesSearch } from '@/lib/search'
import { FilterPanel } from './FilterPanel'
import { ArrowUpRight, MapPin } from 'lucide-react'

const SERVICE_LABELS: Record<string, string> = {
  yes: '明确依据',
  claimed: '间接证据',
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
  /** 外部（如地图全局搜索命中病症）注入的关键词，变化时同步到筛选框 */
  initialQuery?: string
}

export function HospitalExplorer({
  hospitals,
  reports = [],
  provinces,
  reportCounts,
  variant = 'page',
  onSelectHospital,
  initialQuery,
}: Props) {
  const searchParams = useSearchParams()
  const [province, setProvince] = useState(() => searchParams.get('province') ?? '')
  const [category, setCategory] = useState('')
  const [onlyEvidence, setOnlyEvidence] = useState(false)
  const [keyword, setKeyword] = useState(() => initialQuery ?? '')

  useEffect(() => {
    if (initialQuery === undefined) return
    setKeyword(initialQuery)
  }, [initialQuery])

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

  const filterCount = [province, category, keyword.trim(), onlyEvidence].filter(Boolean).length
  const reset = () => { setProvince(''); setCategory(''); setKeyword(''); setOnlyEvidence(false) }

  return (
    <div>
      <FilterPanel compact={variant === 'compact'} count={filterCount}>
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
          仅显示具备创伤服务证据的机构
        </label>
        {filterCount > 0 && <button type="button" className="tc-button tc-filter-reset" onClick={reset}>清除筛选</button>}
      </form>
      </FilterPanel>

      <div className="tc-results-heading" role="status" aria-live="polite">
        <span><strong>{filtered.length}</strong> 家机构</span>
        <span>{filterCount ? '筛选结果' : '全国收录'}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="tc-empty">
          <p>没有符合筛选条件的机构记录。</p>
          <button type="button" className="tc-button" onClick={reset}>清除筛选，查看全部</button>
        </div>
      ) : (
        <div className={`tc-grid tc-grid--cards${variant === 'compact' ? ' tc-grid--compact' : ''}`}>
          {filtered.map((hospital) => (
            <article className="tc-card tc-hospital-card" key={hospital.id}>
              <div className="tc-hospital-location"><MapPin size={13} aria-hidden="true" />{hospital.province}{hospital.city === hospital.province ? '' : ` · ${hospital.city}`}</div>
              <h2>
                {onSelectHospital ? <button type="button" className="tc-linklike" onClick={() => onSelectHospital(hospital.id)}>{hospital.name}</button> : <Link href={`/hospitals/${hospital.id}/`}>{hospital.name}</Link>}
              </h2>
              <div className="tc-row tc-meta">
                <span>{hospital.level === '未知' ? '等级未标注' : hospital.level}</span>
                <span>·</span>
                <span>{hospital.category}</span>
              </div>
              <p className="tc-hospital-departments">
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
              <div className="tc-hospital-card-footer">
                <span className="tc-meta"><b>{reportCounts[hospital.id] ?? 0}</b> 条线索 · {hospital.official_sources.length} 个官方来源</span>
              {onSelectHospital ? (
                <button
                  type="button"
                  className="tc-card-action"
                  aria-label={`查看机构：${hospital.name}`}
                  onClick={() => onSelectHospital(hospital.id)}
                >
                  查看 <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              ) : <Link className="tc-card-action" href={`/hospitals/${hospital.id}/`} aria-label={`查看机构：${hospital.name}`}>详情 <ArrowUpRight size={16} aria-hidden="true" /></Link>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
