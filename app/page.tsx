import Link from 'next/link'
import { ChinaMap } from '@/components/ChinaMap'
import { ReportCard } from '@/components/ReportCard'
import { disorders, hospitals, provinceStats, provinces, publicReports, visibleDisorders } from '@/lib/data'
import { formatCount } from '@/lib/format'

export default function HomePage() {
  const resource = Object.fromEntries(
    provinceStats.items.map((item) => [item.adcode, item.hospitals_with_service_evidence]),
  ) as Record<string, number>
  const leads = Object.fromEntries(
    provinceStats.items.map((item) => [item.adcode, item.reports_total]),
  ) as Record<string, number>
  const hospitalTotals = Object.fromEntries(
    provinceStats.items.map((item) => [item.adcode, item.hospitals_total]),
  ) as Record<string, number>

  const latest = [...publicReports]
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
    .slice(0, 3)

  const { totals } = provinceStats

  return (
    <div>
      <section className="tc-card">
        <h1>创伤知情就诊地图</h1>
        <p className="tc-muted">
          这个项目在收集并公开两件事：哪些地方<strong>能</strong>做创伤相关评估与诊断（有官方或明确证据），
          以及网友在公开平台上留下的<strong>就诊线索</strong>（医院、医生、流程、评价）。
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
        resource={resource}
        leads={leads}
        hospitalTotals={hospitalTotals}
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
