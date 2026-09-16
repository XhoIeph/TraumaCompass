'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href: '/', label: '地图' },
  { href: '/hospitals/', label: '医院' },
  { href: '/doctors/', label: '医生线索' },
  { href: '/reports/', label: '就诊线索' },
  { href: '/submit/', label: '提交线索' },
]

/** 常规页头导航：标出当前页（aria-current="page" + 视觉高亮） */
export function SiteNav() {
  const pathname = usePathname()
  return (
    <nav className="tc-nav" aria-label="主导航">
      {NAV.map((item) => {
        const active =
          item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(item.href)
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined}>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
