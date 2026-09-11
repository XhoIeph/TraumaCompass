'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'

export type SidebarTabId = 'hospitals' | 'reports' | 'about' | 'submit'

const TABS: { id: SidebarTabId; label: string }[] = [
  { id: 'hospitals', label: '机构' },
  { id: 'reports', label: '线索' },
  { id: 'about', label: '关于' },
  { id: 'submit', label: '投稿' },
]

/**
 * Google Maps 式左侧抽屉：
 * - 无选中详情时显示「品牌 + 用量 + Tab 列表」
 * - 选中省份/医院时整个面板切换成详情卡（返回即恢复列表）
 */
export function Sidebar({
  open,
  tabs,
  detail,
  totals,
}: {
  open: boolean
  tabs: Record<SidebarTabId, ReactNode>
  detail: ReactNode | null
  totals: { reports: number; hospitals: number; provincesWithReports: number }
}) {
  const [tab, setTab] = useState<SidebarTabId>('hospitals')

  return (
    <aside className={`tc-sidebar${open ? '' : ' tc-sidebar--closed'}`} aria-label="地图侧边栏">
      <div className="tc-sidebar-head">
        <Link href="/" className="tc-brand">
          TraumaCompass
          <small>创伤知情就诊地图 · 项目早期版本</small>
        </Link>
        <div className="tc-row tc-small tc-sidebar-chips">
          <span className="tc-badge tc-badge--accent">线索 {totals.reports}</span>
          <span className="tc-badge tc-badge--neutral">机构 {totals.hospitals}</span>
          <span className="tc-badge tc-badge--neutral">覆盖 {totals.provincesWithReports} 省</span>
        </div>
        <p className="tc-hotline">
          危机中请拨打心理援助热线 <strong>12356</strong>，或前往就近医院急诊。
        </p>
      </div>

      {detail ? (
        <div className="tc-sidebar-body">{detail}</div>
      ) : (
        <>
          <nav className="tc-sidebar-tabs" role="tablist" aria-label="侧边栏功能">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={`tc-sidebar-tab${tab === item.id ? ' tc-sidebar-tab--active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="tc-sidebar-body" role="tabpanel">
            {tabs[tab]}
          </div>
        </>
      )}
    </aside>
  )
}
