import Link from 'next/link'
import { doctors, hospitalById } from '@/lib/data'

export const metadata = {
  title: '医生条目｜TraumaCompass',
  description: '只在拿到公开执业信息后建立的医生条目；网友评价仅作摘录并标注未经核实。',
}

export default function DoctorsPage() {
  return (
    <div>
      <h1>医生条目</h1>
      <p className="tc-muted">
        医生条目只依据<strong>公开执业信息</strong>（医院官网、国家卫健委执业注册信息查询）建立：
        姓名、科室、职称与专长。网友对医生的评价只以「个人体验、未经核实」的形式摘录并附原帖链接，
        不作为事实陈述，也不参与任何排序。
      </p>

      {doctors.length === 0 ? (
        <div className="tc-empty">
          <p>暂无医生条目。</p>
          <p className="tc-small tc-faint">
            这是刻意保持的保守状态：先把机构与线索跑通，再在有官方执业信息支撑时逐个补医生条目。
          </p>
          <p className="tc-small">
            <Link href="/hospitals/">先看医院列表 →</Link>
          </p>
        </div>
      ) : (
        <div className="tc-grid tc-grid--cards">
          {doctors.map((doctor) => {
            const hospital = hospitalById(doctor.hospital_id)
            return (
              <div className="tc-card" key={doctor.id}>
                <h2 style={{ marginBottom: 4 }}>
                  <Link href={`/doctors/${doctor.id}/`}>{doctor.name}</Link>
                </h2>
                <p className="tc-small tc-muted" style={{ margin: 0 }}>
                  {doctor.title} · {doctor.department}
                  {hospital ? ` · ${hospital.name}` : ''}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
