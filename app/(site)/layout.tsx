import type { ReactNode } from 'react'
import { Brand } from '@/components/Brand'
import { SiteNav } from '@/components/SiteNav'

/** 常规内容页布局：顶栏导航 + 正文容器 + 页脚（首页的全屏地图不经过这里） */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tc-shell">
      <header className="tc-header">
        <div className="tc-container tc-header-inner">
          <Brand height={28} subtitle="创伤知情就诊地图 · 项目早期版本" />
          <SiteNav />
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
