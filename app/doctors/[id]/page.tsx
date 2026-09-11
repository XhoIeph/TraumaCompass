import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReportCard } from '@/components/ReportCard'
import { doctorById, doctors, disorders, hospitalById, publicReports } from '@/lib/data'

export const dynamicParams = false

/**
 * 静态导出要求动态路由至少产出一个页面。当前还没有医生条目，
 * 因此先生成一个空状态页；一旦 doctors.json 有数据，会自动改为逐个生成。
 */
const EMPTY_STATE_ID = 'none'

export function generateStaticParams() {
  if (doctors.length === 0) return [{ id: EMPTY_STATE_ID }]
  return doctors.map((doctor) => ({ id: doctor.id }))
}

export default async function DoctorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  if (id === EMPTY_STATE_ID) {
    return (
      <div>
        <h1>医生条目</h1>
        <div className="tc-empty">
          <p>暂无医生条目。</p>
          <p className="tc-small tc-faint">
            我们只在拿到公开执业信息（医院官网或国家卫健委执业注册信息查询）后建立医生条目。
          </p>
          <p className="tc-small">
            <Link href="/doctors/">← 返回医生列表</Link>
          </p>
        </div>
      </div>
    )
  }

  const doctor = doctorById(id)
  if (!doctor) notFound()

  const hospital = hospitalById(doctor.hospital_id)
  const reports = publicReports.filter((report) => report.doctor_id === doctor.id)

  return (
    <div>
      <p className="tc-small tc-muted">
        <Link href="/doctors/">← 返回医生列表</Link>
      </p>

      <h1>{doctor.name}</h1>
      <p className="tc-muted">
        {doctor.title} · {doctor.department}
        {hospital ? (
          <>
            {' · '}
            <Link href={`/hospitals/${hospital.id}/`}>{hospital.name}</Link>
          </>
        ) : null}
      </p>

      <div className="tc-card">
        <h2>公开执业信息</h2>
        <table className="tc-table">
          <tbody>
            <tr>
              <th>专长</th>
              <td>{doctor.specialties.length > 0 ? doctor.specialties.join('、') : '暂无记录'}</td>
            </tr>
            {doctor.credentials.length > 0 && (
              <tr>
                <th>资质</th>
                <td>{doctor.credentials.join('、')}</td>
              </tr>
            )}
            <tr>
              <th>公开来源</th>
              <td>
                {doctor.profile_urls.length === 0 && doctor.official_sources.length === 0 ? (
                  '暂无'
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                    {[...doctor.official_sources, ...doctor.profile_urls].map((source) => (
                      <li key={source}>
                        <a href={source} target="_blank" rel="nofollow noopener noreferrer">
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
            <tr>
              <th>最近核实</th>
              <td>{doctor.last_verified_at}</td>
            </tr>
          </tbody>
        </table>
        {doctor.note && <p className="tc-small tc-muted">{doctor.note}</p>}
      </div>

      <div className="tc-card">
        <h2>提及该医生的线索（{reports.length}）</h2>
        <p className="tc-small tc-muted">
          以下内容为网友个人体验摘录，<strong>未经核实、不代表本站观点</strong>，也不能替代面诊判断。
        </p>
        {reports.length === 0 ? (
          <p className="tc-small tc-muted" style={{ margin: 0 }}>
            暂无关联线索。
          </p>
        ) : (
          reports.map((report) => <ReportCard key={report.id} report={report} disorders={disorders} />)
        )}
      </div>
    </div>
  )
}
