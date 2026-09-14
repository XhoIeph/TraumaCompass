import type { ReactNode } from 'react'
import Link from 'next/link'

const NAV = [
  { href: '/', label: '地图' },
  { href: '/hospitals/', label: '医院' },
  { href: '/doctors/', label: '医生' },
  { href: '/reports/', label: '就诊线索' },
  { href: '/submit/', label: '提交线索' },
]

/** 常规内容页布局：顶栏导航 + 正文容器 + 页脚（首页的全屏地图不经过这里） */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tc-shell">
      <header className="tc-header">
        <div className="tc-container tc-header-inner">
          <Link href="/" className="tc-brand">
            TraumaCompass
            <small>创伤知情就诊地图 · 项目早期版本</small>
          </Link>
          <nav className="tc-nav" aria-label="主导航">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="tc-main">
        <div className="tc-container">{children}</div>
      </main>

      <footer className="tc-footer">
        <div className="tc-container">
          <p>仅供就诊信息参考，不提供医疗建议。心理援助热线 <a href="tel:12356">12356</a>。</p>
        </div>
      </footer>
    </div>
  )
}
