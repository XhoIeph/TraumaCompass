'use client'

import { useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Disorder, Province, Report } from '@/lib/schema'
import { PLATFORM_LABELS } from '@/lib/format'
import { ReportCard } from './ReportCard'

type Props = {
  reports: Report[]
  disorders: Disorder[]
  provinces: Province[]
  reportProvince: Record<string, string>
  hospitalNames: Record<string, string>
}

export function ReportExplorer({ reports, disorders, provinces, reportProvince, hospitalNames }: Props) {
  const searchParams = useSearchParams()
  const [province, setProvince] = useState(() => searchParams.get('province') ?? '')
  const [platform, setPlatform] = useState(() => searchParams.get('platform') ?? '')
  const [disorder, setDisorder] = useState(() => searchParams.get('disorder') ?? '')
  const [keyword, setKeyword] = useState('')

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
        if (!haystack.includes(needle)) return false
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
      <form className="tc-card tc-filters" onSubmit={(event) => event.preventDefault()}>
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
                {item.name_zh}
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
        共 {reports.length} 条已发布线索，当前筛选出 {filtered.length} 条。
        每条都来自公开平台的自述摘录，标注了发表时间、地区来源与核验等级。
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
            <ReportCard
              key={report.id}
              report={report}
              disorders={disorders}
              showHospital={Boolean(hospitalNames[report.hospital_id ?? ''] ?? true)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

