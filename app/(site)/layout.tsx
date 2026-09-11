import type { ReactNode } from 'react'
import Link from 'next/link'

const NAV = [
  { href: '/', label: '地图' },
  { href: '/hospitals/', label: '医院' },
  { href: '/doctors/', label: '医生' },
  { href: '/reports/', label: '就诊线索' },
  { href: '/about/', label: '关于与方法' },
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
          <p>
            <strong>本站不是医疗机构，也不提供诊断或治疗建议。</strong>
            所有「就诊线索」均为网友在公开平台的自述摘录，不代表本站观点；
            每条都附有原帖链接，可自行核对原话；请以精神科执业医师的面诊结论为准。
          </p>
          <p>
            如果你正处于危机中，可拨打全国统一心理援助热线 <strong>12356</strong>
            （国家卫生健康委统一号码），或前往就近医院急诊。
          </p>
          <p className="tc-faint">
            底图为示意性质的非标准地图；数据与代码以 Apache-2.0 许可开源。
            <Link href="/about/"> 查看数据来源、核验标准与撤下流程</Link>。
          </p>
        </div>
      </footer>
    </div>
  )
}
