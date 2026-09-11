import { Suspense } from 'react'
import { ReportExplorer } from '@/components/ReportExplorer'
import { disorders, hospitals, provinces, publicReports, reportProvinceMap } from '@/lib/data'

export const metadata = {
  title: '就诊线索｜TraumaCompass',
  description: 'CPTSD / BPD 相关的公开就诊线索摘录：平台、时间、地区来源、医院、医生与评价，逐条标注核验等级。',
}

export default function ReportsPage() {
  const hospitalNames = Object.fromEntries(hospitals.map((hospital) => [hospital.id, hospital.name]))

  return (
    <div>
      <h1>就诊线索</h1>
      <p className="tc-muted">
        下面每一条都来自公开平台的自述摘录，署名一律做哈希化处理，并保留原帖链接。
        「核验等级」说明这条线索有多少依据：
        <strong>官方来源</strong>（医院官网/卫健委等）、<strong>多源印证</strong>（多条独立线索吻合）、
        <strong>未核实</strong>（单条自述）。
      </p>

      <Suspense fallback={<p className="tc-muted">加载筛选中……</p>}>
        <ReportExplorer
          reports={publicReports}
          disorders={disorders}
          provinces={provinces}
          reportProvince={reportProvinceMap()}
          hospitalNames={hospitalNames}
        />
      </Suspense>
    </div>
  )
}
