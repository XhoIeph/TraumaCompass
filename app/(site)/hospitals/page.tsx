import { Suspense } from 'react'
import { HospitalExplorer } from '@/components/HospitalExplorer'
import { hospitals, provinces, publicReports } from '@/lib/data'
import Link from 'next/link'

export const metadata = {
  title: '医院与机构｜TraumaCompass',
  description: '收录可提供创伤相关评估与诊断的医院与科室记录，逐条标注官方来源与创伤服务证据。',
}

export default function HospitalsPage() {
  const reportCounts: Record<string, number> = {}
  for (const report of publicReports) {
    if (!report.hospital_id) continue
    reportCounts[report.hospital_id] = (reportCounts[report.hospital_id] ?? 0) + 1
  }

  return (
    <div>
      <header className="tc-page-heading">
        <div><span className="tc-page-eyebrow">就诊资源目录</span><h1>医院与机构</h1><p>按地区与服务信息查找机构，查看公开来源和关联就诊线索。</p></div>
        <Link href="/" className="tc-button">在地图中浏览 →</Link>
      </header>
      <Suspense fallback={<p className="tc-muted">加载筛选中……</p>}>
        <HospitalExplorer hospitals={hospitals} reports={publicReports} provinces={provinces} reportCounts={reportCounts} />
      </Suspense>
    </div>
  )
}
