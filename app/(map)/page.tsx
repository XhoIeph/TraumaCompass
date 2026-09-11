import { MapApp } from '@/components/map/MapApp'
import {
  disorders,
  hospitals,
  provinceStats,
  provinces,
  publicReports,
  reportProvinceMap,
  visibleDisorders,
} from '@/lib/data'

export default function MapPage() {
  // 地图节点：只放有坐标的机构；节点旁的数据来自关联线索
  const mapHospitals = hospitals
    .filter((hospital) => hospital.coordinates)
    .map((hospital) => {
      const linked = publicReports.filter((report) => report.hospital_id === hospital.id)
      return {
        id: hospital.id,
        name: hospital.name,
        adcode: hospital.adcode,
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

  const statMap = Object.fromEntries(
    provinceStats.items.map((item) => [
      item.adcode,
      {
        reports: item.reports_total,
        hospitals: item.hospitals_total,
        withEvidence: item.hospitals_with_service_evidence,
        cptsd: item.reports_by_disorder.cptsd,
        bpd: item.reports_by_disorder.bpd,
      },
    ]),
  )

  const reportCounts = Object.fromEntries(
    hospitals.map((hospital) => [
      hospital.id,
      publicReports.filter((report) => report.hospital_id === hospital.id).length,
    ]),
  )

  const hospitalNames = Object.fromEntries(hospitals.map((hospital) => [hospital.id, hospital.name]))

  const { totals } = provinceStats

  return (
    <MapApp
      provinces={provinces}
      mapHospitals={mapHospitals}
      leadsByHospital={mapLeads}
      provinceStats={statMap}
      totals={{
        reports: totals.reports,
        hospitals: totals.hospitals,
        provincesWithReports: totals.provinces_with_reports,
      }}
      hospitals={hospitals}
      reports={publicReports}
      disorders={disorders}
      visibleDisorders={visibleDisorders}
      reportProvince={reportProvinceMap()}
      hospitalNames={hospitalNames}
      reportCounts={reportCounts}
    />
  )
}
