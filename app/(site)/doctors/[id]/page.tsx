import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReportCard } from '@/components/ReportCard'
import { SourceLink } from '@/components/SourceLink'
import { doctorById, doctors, disorders, hospitalById, publicReports } from '@/lib/data'

export const dynamicParams = false

/**
 * 静态导出要求动态路由至少产出一个页面。当前还没有「公开执业信息条目」，
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
        <h1>公开执业信息条目</h1>
        <div className="tc-empty">
          <p>目前还没有公开执业信息条目。</p>
          <p className="tc-small tc-faint">
            这一区块只收录能从公开渠道（医院官网、国家卫健委执业注册信息查询）确认的姓名、科室与职称，
            因此刻意保持保守，避免凭网友描述推断。
          </p>
          <p className="tc-small">
            想看网友提到过的医生，请到 <Link href="/doctors/">医生线索</Link>，
            或在地图侧栏的「医生线索」中按病症查看。
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
    <div className="tc-prose">
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
                        <SourceLink url={source} />
                      </li>
                    ))}
                  </ul>
                )}
              </td>
            </tr>
            <tr>
              <th>官方来源核对</th>
              <td>{doctor.last_verified_at}</td>
            </tr>
          </tbody>
        </table>
        {doctor.note && <p className="tc-small tc-muted">{doctor.note}</p>}
      </div>

      <div className="tc-card">
        <h2>提及该医生的线索（{reports.length}）</h2>
        <p className="tc-small tc-muted">
          以下内容为网友个人体验摘录，<strong>不代表本站观点</strong>，也不能替代面诊判断；
          每条都附原帖链接，可自行核对上下文。
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
