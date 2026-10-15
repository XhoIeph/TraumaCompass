import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ReportCard } from '@/components/ReportCard'
import { SourceLink } from '@/components/SourceLink'
import { doctorsForHospital, disorders, hospitalById, hospitals, reportsForHospital } from '@/lib/data'

export const dynamicParams = false

export function generateStaticParams() {
  return hospitals.map((hospital) => ({ id: hospital.id }))
}

const SERVICE_LABELS: Record<string, string> = {
  yes: '明确依据',
  claimed: '间接证据',
  unknown: '未知',
  no: '无',
}

export default async function HospitalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hospital = hospitalById(id)
  if (!hospital) notFound()

  const reports = reportsForHospital(hospital.id)
  const doctors = doctorsForHospital(hospital.id)

  return (
    <div className="tc-prose">
      <p className="tc-small tc-muted">
        <Link href="/hospitals/">← 返回医院列表</Link>
      </p>

      <h1>{hospital.name}</h1>
      <div className="tc-row tc-small" style={{ marginBottom: 'var(--tc-space-3)' }}>
        <span className="tc-badge tc-badge--neutral">{hospital.level}</span>
        <span className="tc-badge tc-badge--neutral">{hospital.category}</span>
        <span className="tc-badge tc-badge--neutral">
          {hospital.province}
          {hospital.city === hospital.province ? '' : ` · ${hospital.city}`}
        </span>
        {hospital.official_sources.length > 0 ? (
          <span className="tc-badge tc-badge--official">有官方来源</span>
        ) : (
          <span className="tc-badge tc-badge--unverified">暂无官方来源</span>
        )}
      </div>

      <div className="tc-card">
        <h2>创伤相关服务</h2>
        <table className="tc-table">
          <tbody>
            <tr>
              <th>CPTSD 评估</th>
              <td>{SERVICE_LABELS[hospital.trauma_service.cptsd_assessment]}</td>
            </tr>
            <tr>
              <th>CPTSD / BPD 诊断</th>
              <td>{SERVICE_LABELS[hospital.trauma_service.cptsd_bpd_diagnosis]}</td>
            </tr>
            <tr>
              <th>科室</th>
              <td>{hospital.departments.join('、')}</td>
            </tr>
          </tbody>
        </table>

        {hospital.trauma_service.evidence.length > 0 && (
          <div className="tc-stack" style={{ marginTop: 'var(--tc-space-3)' }}>
            <h3>证据</h3>
            <ul className="tc-small">
              {hospital.trauma_service.evidence.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="tc-card">
        <h2>机构信息</h2>
        <table className="tc-table">
          <tbody>
            {hospital.aliases.length > 0 && (
              <tr>
                <th>别名</th>
                <td>{hospital.aliases.join('、')}</td>
              </tr>
            )}
            {hospital.address && (
              <tr>
                <th>地址</th>
                <td>{hospital.address}</td>
              </tr>
            )}
            {hospital.phone_public && (
              <tr>
                <th>公开电话</th>
                <td>{hospital.phone_public}</td>
              </tr>
            )}
            <tr>
              <th>官方来源</th>
              <td>
                {hospital.official_sources.length === 0 ? (
                  '暂无'
                ) : (
                  <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                    {hospital.official_sources.map((source) => (
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
              <td>{hospital.last_verified_at}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {doctors.length > 0 && (
        <div className="tc-card">
          <h2>关联医生（{doctors.length}）</h2>
          <ul>
            {doctors.map((doctor) => (
              <li key={doctor.id}>
                <Link href={`/doctors/${doctor.id}/`}>
                  {doctor.name} · {doctor.title} · {doctor.department}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="tc-card">
        <h2>关联就诊线索（{reports.length}）</h2>
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
