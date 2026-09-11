'use client'

import Link from 'next/link'
import type { MapHospital, MapProvinceStat } from './types'

/** 侧栏中的省份概要卡：由全国视图点击省份触发 */
export function ProvinceDetail({
  provinceName,
  adcode,
  stat,
  hospitals,
  onClose,
  onZoomToProvince,
  onSelectHospital,
}: {
  provinceName: string
  adcode: string
  stat: MapProvinceStat | undefined
  hospitals: MapHospital[]
  onClose: () => void
  onZoomToProvince: () => void
  onSelectHospital: (id: string) => void
}) {
  const hasData = (stat?.reports ?? 0) > 0 || hospitals.length > 0

  return (
    <div className="tc-stack">
      <div className="tc-row tc-row--between">
        <h2 style={{ marginBottom: 0, fontSize: '1.05rem' }}>{provinceName}</h2>
        <button type="button" className="tc-button" onClick={onClose} aria-label="关闭详情">
          关闭
        </button>
      </div>

      {hasData ? (
        <>
          <div className="tc-row tc-small">
            <span className="tc-badge tc-badge--accent">线索 {stat?.reports ?? 0} 条</span>
            <span className="tc-badge tc-badge--neutral">
              机构 {stat?.hospitals ?? hospitals.length} 家
            </span>
            {(stat?.withEvidence ?? 0) > 0 && (
              <span className="tc-badge tc-badge--official">
                有创伤服务证据 {stat?.withEvidence} 家
              </span>
            )}
          </div>
          {(stat?.cptsd ?? 0) > 0 || (stat?.bpd ?? 0) > 0 ? (
            <p className="tc-small tc-muted" style={{ margin: 0 }}>
              线索涉及：CPTSD {stat?.cptsd} 条 · BPD {stat?.bpd} 条
              <span className="tc-faint">（同一条线索可能同时涉及两者）</span>
            </p>
          ) : null}

          <button type="button" className="tc-button" onClick={onZoomToProvince}>
            放大到该省查看医院节点
          </button>

          {hospitals.length > 0 && (
            <>
              <hr className="tc-divider" />
              <h3 style={{ marginBottom: 0 }}>该省机构（{hospitals.length}）</h3>
              <ul className="tc-plainlist">
                {hospitals.map((hospital) => (
                  <li key={hospital.id}>
                    <button
                      type="button"
                      className="tc-linklike"
                      onClick={() => onSelectHospital(hospital.id)}
                    >
                      {hospital.name}
                    </button>
                    <span className="tc-meta"> · 线索 {hospital.leads} 条</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <div className="tc-empty" style={{ padding: 'var(--tc-space-4)' }}>
          <p style={{ margin: 0 }}>该省暂无已收录的线索与机构记录。</p>
          <p className="tc-small tc-faint">
            数据仍在持续收集中；如果你了解公开来源，欢迎
            <Link href="/submit/"> 提交线索</Link>。
          </p>
        </div>
      )}
      <p className="tc-meta" style={{ margin: 0 }}>
        行政区划代码 {adcode}
      </p>
    </div>
  )
}
