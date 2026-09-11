import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TraumaCompass｜创伤知情就诊地图',
  description:
    'CPTSD / BPD 等创伤相关诊断的国内就诊资源与网友自述线索地图。数据来自公开平台自述与官方来源，每条线索都附原帖链接。',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
