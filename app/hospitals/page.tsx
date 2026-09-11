import { Suspense } from 'react'
import { HospitalExplorer } from '@/components/HospitalExplorer'
import { hospitals, provinces, publicReports } from '@/lib/data'

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
      <h1>医院与机构</h1>
      <p className="tc-muted">
        每条记录都优先依据<strong>医院官网、卫健委等官方来源</strong>建立。
        「CPTSD 评估」「CPTSD/BPD 诊断」两栏只有在拿到明确依据时才标注「有明确依据」，
        只有网友提及时标注「仅有线索提及」，否则一律显示「未知」——
        未知不等于没有，只表示我们还没有可追溯的证据。
      </p>

      <Suspense fallback={<p className="tc-muted">加载筛选中……</p>}>
        <HospitalExplorer hospitals={hospitals} provinces={provinces} reportCounts={reportCounts} />
      </Suspense>
    </div>
  )
}
