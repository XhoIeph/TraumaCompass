'use client'

import { useId, useState, type ReactNode } from 'react'
import { ChevronDown, SlidersHorizontal } from 'lucide-react'

/** 两种列表共用的筛选入口。窄面板默认收起，已选条件仍明确显示。 */
export function FilterPanel({ compact, count, children }: {
  compact: boolean
  count: number
  children: ReactNode
}) {
  const [open, setOpen] = useState(!compact)
  const id = useId()
  return (
    <section className="tc-filter-panel">
      <button className="tc-filter-toggle" type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>筛选条件{count > 0 && <b>{count}</b>}</span>
        <span className="tc-filter-hint">{count ? '已筛选' : '全部地区'}</span>
        <ChevronDown size={16} aria-hidden="true" className={open ? 'tc-chevron--open' : ''} />
      </button>
      <div id={id} hidden={!open}>{children}</div>
    </section>
  )
}
