import Link from 'next/link'
import { ChinaMap } from '@/components/ChinaMap'
import { ReportCard } from '@/components/ReportCard'
import { disorders, hospitals, provinceStats, provinces, publicReports, visibleDisorders } from '@/lib/data'
import { formatCount } from '@/lib/format'

export default function HomePage() {
  // 地图节点：只放有坐标的机构；节点旁的数据来自关联线索
  const mapHospitals = hospitals
    .filter((hospital) => hospital.coordinates)
    .map((hospital) => {
      const linked = publicReports.filter((report) => report.hospital_id === hospital.id)
      return {
        id: hospital.id,
        name: hospital.name,
        province: hospital.province,
        city: hospital.city,
        category: hospital.category,
        level: hospital.level,
        lat: hospital.coordinates?.lat ?? 0,
        lng: hospital.coordinates?.lng ?? 0,
        coordinateSource: hospital.coordinates_source,
        leads: linked.length,
        evidenceCount: hospital.trauma_service.evidence.length,
        doctors: [
          ...new Set(
            linked
              .flatMap((report) => (report.doctor_name_raw ?? '').split(/[、,，/]/))
              .map((name) => name.trim())
              .filter((name) => name.length >= 2),
          ),
        ],
      }
    })

  const mapLeads = Object.fromEntries(
    mapHospitals.map((hospital) => [
      hospital.id,
      publicReports
        .filter((report) => report.hospital_id === hospital.id)
        .map((report) => ({
          id: report.id,
          quote: report.evidence_quote,
          contextNote: report.evidence_context?.parent_excerpt
            ? `该评论回复的原话：「${report.evidence_context.parent_excerpt}」`
            : report.evidence_context?.note_title
              ? `来自《${report.evidence_context.note_title}》的评论区`
              : undefined,
          doctor: report.doctor_name_raw,
          stage: report.stage,
          platform: report.platform,
          publishedAt: report.published_at,
          url: report.source_url,
        })),
    ]),
  )

  const latest = [...publicReports]
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, 3)

  const { totals } = provinceStats

  return (
    <div>
      <section className="tc-card">
        <h1>创伤知情就诊地图</h1>
        <p className="tc-muted">
          这个项目在收集并公开两件事：哪些地方的机构<strong>有官方证据</strong>支撑其创伤相关服务能力
          （创伤治疗项目、专科门诊、培训体系等），以及网友在公开平台上留下的<strong>就诊线索</strong>
          （医院、医生、流程、评价）。
          首期只覆盖 CPTSD 与 BPD。
        </p>
        <div className="tc-note tc-note--warn" style={{ marginBottom: 0 }}>
          <strong>读之前请先知道：</strong>
          线索密度反映的是「有多少人愿意在网上讲」，不是某地的确诊人数或医疗水平；
          官方诊断体系与医保编码的落差才是本项目的核心议题，详见
          <Link href="/about/"> 关于与方法</Link>。
        </div>
      </section>

      <section className="tc-grid tc-grid--stats" style={{ marginBottom: 'var(--tc-space-4)' }}>
        <div className="tc-stat">
          <div className="tc-stat-value">{formatCount(totals.reports)}</div>
          <div className="tc-stat-label">已发布就诊线索</div>
        </div>
        <div className="tc-stat">
          <div className="tc-stat-value">{formatCount(totals.hospitals)}</div>
          <div className="tc-stat-label">机构记录</div>
        </div>
        <div className="tc-stat">
          <div className="tc-stat-value">{formatCount(totals.provinces_with_reports)}</div>
          <div className="tc-stat-label">已有线索的省级行政区</div>
        </div>
        <div className="tc-stat">
          <div className="tc-stat-value">{formatCount(visibleDisorders.length)}</div>
          <div className="tc-stat-label">首期疾病条目</div>
        </div>
      </section>

      <ChinaMap
        provinces={provinces.map((province) => ({
          adcode: province.adcode,
          name: province.name,
          short_name: province.short_name,
        }))}
        provinceStats={Object.fromEntries(
          provinceStats.items.map((item) => [
            item.adcode,
            {
              reports: item.reports_total,
              hospitals: item.hospitals_total,
              withEvidence: item.hospitals_with_service_evidence,
            },
          ]),
        )}
        hospitals={mapHospitals}
        leadsByHospital={mapLeads}
      />

      <section style={{ marginTop: 'var(--tc-space-5)' }}>
        <h2>首期收录的诊断</h2>
        <div className="tc-grid tc-grid--cards">
          {visibleDisorders.map((disorder) => (
            <article className="tc-card" key={disorder.id}>
              <h3 style={{ marginBottom: 4 }}>{disorder.name_zh}</h3>
              <div className="tc-row tc-small">
                <span className="tc-badge tc-badge--accent">ICD-11 {disorder.icd11_code}</span>
                <span className="tc-badge tc-badge--neutral">
                  ICD-10 {disorder.icd10_equivalent ?? '无对应类目'}
                </span>
                {disorder.code_review_status === 'pending_review' && (
                  <span className="tc-badge tc-badge--unverified">编码待核对</span>
                )}
              </div>
              <p className="tc-small tc-muted" style={{ marginTop: 8 }}>
                {disorder.summary}
              </p>
            </article>
          ))}
        </div>
      </section>

      {latest.length > 0 ? (
        <section style={{ marginTop: 'var(--tc-space-5)' }}>
          <h2>最近收录的线索</h2>
          {latest.map((report) => (
            <ReportCard key={report.id} report={report} disorders={disorders} />
          ))}
          <p className="tc-small">
            <Link href="/reports/">查看全部线索 →</Link>
          </p>
        </section>
      ) : (
        <section style={{ marginTop: 'var(--tc-space-5)' }}>
          <h2>最近收录的线索</h2>
          <div className="tc-empty">
            <p>线索库正在建设中：框架、字段规范与采集流程已就绪，正在按平台逐条收集可追溯的公开来源。</p>
            <p className="tc-small tc-faint">
              当前已有 {hospitals.length} 家机构记录与 34 个省级行政区底图，采集完成后这里会自动填充。
            </p>
            <p className="tc-small">
              <Link href="/submit/">我知道一些公开来源，想提交线索 →</Link>
            </p>
          </div>
        </section>
      )}
    </div>
  )
}
