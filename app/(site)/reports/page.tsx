import { Suspense } from 'react'
import { ReportExplorer } from '@/components/ReportExplorer'
import { disorders, hospitals, provinces, publicReports, reportProvinceMap } from '@/lib/data'

export const metadata = {
  title: '就诊线索｜TraumaCompass',
  description: 'CPTSD / BPD 相关的公开就诊线索摘录：平台、时间、地区来源、医院、医生与评价，附原帖链接供自行核对。',
}

export default function ReportsPage() {
  const hospitalNames = Object.fromEntries(hospitals.map((hospital) => [hospital.id, hospital.name]))

  return (
    <div>
      <h1>就诊线索</h1>
      <p className="tc-muted">
        下面每一条都来自公开平台的自述摘录，<strong>不记录任何用户标识</strong>（没有昵称、没有账号、没有 IP），
        只给出平台、时间与原帖链接，你可以自己点进去核对原话。
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

