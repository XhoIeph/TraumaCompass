'use client'

import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import Link from 'next/link'
import { Brand } from '@/components/Brand'

export type SidebarTabId = 'hospitals' | 'reports' | 'doctors' | 'submit'

const TABS: { id: SidebarTabId; label: string }[] = [
  { id: 'hospitals', label: '机构' },
  { id: 'reports', label: '线索' },
  { id: 'doctors', label: '医生线索' },
  { id: 'submit', label: '投稿' },
]

/**
 * Google Maps 式左侧抽屉：
 * - 无选中详情时显示「品牌 + 用量 + Tab 列表」
 * - 选中省份/医院时整个面板切换成详情卡（返回即恢复列表）
 * - 标签栏实现完整 tablist 键盘交互（←/→/Home/End）
 * - 移动端为 modal drawer：由 MapApp 负责遮罩、焦点进入与 Escape 关闭；这里提供显式关闭按钮
 */
export function Sidebar({
  id,
  open,
  tabs,
  detail,
  totals,
  onClose,
  panelRef,
  activeTab,
  onTabChange,
}: {
  id?: string
  open: boolean
  tabs: Record<SidebarTabId, ReactNode>
  detail: ReactNode | null
  totals: { reports: number; hospitals: number; provincesWithReports: number }
  onClose?: () => void
  panelRef?: Ref<HTMLElement>
  /** 受控标签（地图全局搜索需要切换到指定标签）；不传时组件自管 */
  activeTab?: SidebarTabId
  onTabChange?: (tab: SidebarTabId) => void
}) {
  const [internalTab, setInternalTab] = useState<SidebarTabId>('hospitals')
  const tab = activeTab ?? internalTab
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const setTab = (next: SidebarTabId) => {
    setInternalTab(next)
    onTabChange?.(next)
  }

  useEffect(() => {
    const panel = new URLSearchParams(window.location.search).get('panel')
    if (panel && TABS.some(item => item.id === panel)) setTab(panel as SidebarTabId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const moveTab = (delta: number) => {
    const index = TABS.findIndex(item => item.id === tab)
    const next = TABS[(index + delta + TABS.length) % TABS.length]
    setTab(next.id)
    tabRefs.current[next.id]?.focus()
  }

  return (
    <aside
      id={id}
      ref={panelRef}
      className={`tc-sidebar${open ? '' : ' tc-sidebar--closed'}`}
      aria-label="地图侧边栏"
      inert={!open}
    >
      <div className="tc-sidebar-head">
        <div className="tc-row tc-row--between" style={{ alignItems: 'flex-start' }}>
          <Brand height={32} subtitle="找到可以求助的地方" />
          {onClose && (
            <button type="button" className="tc-sidebar-close" onClick={onClose} aria-label="收起侧边栏">
              ✕
            </button>
          )}
        </div>
        <div className="tc-row tc-small tc-sidebar-chips">
          <span className="tc-badge tc-badge--accent">线索 {totals.reports}</span>
          <span className="tc-badge tc-badge--neutral">机构 {totals.hospitals}</span>
          <span className="tc-badge tc-badge--neutral">覆盖 {totals.provincesWithReports} 省</span>
        </div>
        <p className="tc-hotline">
          心理援助 <strong>12356</strong>
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
                ref={(node) => { tabRefs.current[item.id] = node }}
                type="button"
                role="tab"
                id={`tc-sidebar-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls="tc-sidebar-panel"
                tabIndex={tab === item.id ? 0 : -1}
                className={`tc-sidebar-tab${tab === item.id ? ' tc-sidebar-tab--active' : ''}`}
                onClick={() => setTab(item.id)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight') { event.preventDefault(); moveTab(1) }
                  else if (event.key === 'ArrowLeft') { event.preventDefault(); moveTab(-1) }
                  else if (event.key === 'Home') { event.preventDefault(); setTab(TABS[0].id); tabRefs.current[TABS[0].id]?.focus() }
                  else if (event.key === 'End') { event.preventDefault(); setTab(TABS[TABS.length - 1].id); tabRefs.current[TABS[TABS.length - 1].id]?.focus() }
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <div className="tc-sidebar-body" role="tabpanel" id="tc-sidebar-panel" aria-labelledby={`tc-sidebar-tab-${tab}`}>
            {tabs[tab]}
          </div>
        </>
      )}
    </aside>
  )
}
