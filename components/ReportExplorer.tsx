'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Disorder, Province, Report } from '@/lib/schema'
import { PLATFORM_LABELS } from '@/lib/format'
import { matchesSearch } from '@/lib/search'
import { ReportCard } from './ReportCard'

type Props = {
  reports: Report[]
  disorders: Disorder[]
  provinces: Province[]
  reportProvince: Record<string, string>
  hospitalNames: Record<string, string>
  /** compact：适配侧边栏窄面板（默认 page 不变） */
  variant?: 'page' | 'compact'
  /** 提供时，关联了机构的线索卡出现「在地图上查看」按钮 */
  onSelectHospital?: (id: string) => void
  /** 外部（如地图全局搜索命中病症）注入的关键词，变化时同步到筛选框 */
  initialQuery?: string
  /** 外部注入的病症筛选（值为 disorders 的 id） */
  initialDisorder?: string
}

export function ReportExplorer({
  reports,
  disorders,
  provinces,
  reportProvince,
  hospitalNames,
  variant = 'page',
  onSelectHospital,
  initialQuery,
  initialDisorder,
}: Props) {
  const searchParams = useSearchParams()
  const [province, setProvince] = useState(() => searchParams.get('province') ?? '')
  const [platform, setPlatform] = useState(() => searchParams.get('platform') ?? '')
  const [disorder, setDisorder] = useState(() => searchParams.get('disorder') ?? initialDisorder ?? '')
  const [keyword, setKeyword] = useState(() => initialQuery ?? '')

  useEffect(() => {
    if (initialQuery !== undefined) setKeyword(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (initialDisorder !== undefined) setDisorder(initialDisorder)
  }, [initialDisorder])

  const platformOptions = useMemo(
    () => [...new Set(reports.map((report) => report.platform))].sort(),
    [reports],
  )

  const filtered = useMemo(() => {
    const needle = keyword.trim()
    return reports.filter((report) => {
      if (province && reportProvince[report.id] !== province) return false
      if (platform && report.platform !== platform) return false
      if (disorder && !report.disorders.includes(disorder as Report['disorders'][number])) return false
      if (needle) {
        const haystack = [
          report.evidence_quote,
          report.hospital_name_raw,
          report.department,
          report.doctor_name_raw,
          report.self_reported_region,
        ]
          .filter(Boolean)
          .join(' ')
        if (!matchesSearch(haystack, needle)) return false
      }
      return true
    })
  }, [disorder, keyword, platform, province, reportProvince, reports])

  const reset = () => {
    setProvince('')
    setPlatform('')
    setDisorder('')
    setKeyword('')
  }

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
          平台
          <select value={platform} onChange={(event) => setPlatform(event.target.value)}>
            <option value="">全部</option>
            {platformOptions.map((item) => (
              <option key={item} value={item}>
                {PLATFORM_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <label className="tc-field">
          疾病
          <select value={disorder} onChange={(event) => setDisorder(event.target.value)}>
            <option value="">全部</option>
            {disorders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.id === 'other' ? '其他' : item.id.toUpperCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="tc-field">
          关键词
          <input
            type="search"
            value={keyword}
            placeholder="医院 / 医生 / 正文"
            onChange={(event) => setKeyword(event.target.value)}
          />
        </label>

        <button type="button" className="tc-button" onClick={reset}>
          重置
        </button>
      </form>

      <p className="tc-small tc-muted">
        {filtered.length} 条线索
      </p>

      {filtered.length === 0 ? (
        <div className="tc-empty">
          <p>没有符合筛选条件的线索。</p>
          <p className="tc-small tc-faint">
            目前数据集仍在早期建设阶段，欢迎通过「提交线索」补充你了解的公开来源。
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((report) => (
            <div key={report.id}>
              <ReportCard
                report={report}
                onSelectHospital={onSelectHospital}
                disorders={disorders}
                showHospital={Boolean(hospitalNames[report.hospital_id ?? ''] ?? true)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

