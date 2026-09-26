import type { ReactNode } from 'react'
import { Brand } from '@/components/Brand'
import { SiteNav } from '@/components/SiteNav'

/** 常规内容页布局：顶栏导航 + 正文容器 + 页脚（首页的全屏地图不经过这里） */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="tc-shell">
      <a className="tc-skip-link" href="#main-content">跳到正文</a>
      <header className="tc-header">
        <div className="tc-container tc-header-inner">
          <Brand height={40} className="tc-brand--site" />
          <SiteNav />
        </div>
      </header>

      <main className="tc-main" id="main-content" tabIndex={-1}>
        <div className="tc-container">{children}</div>
      </main>

      <footer className="tc-footer">
        <div className="tc-container">
          <p>© 2026 TraumaCompass. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
