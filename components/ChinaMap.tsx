'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { PLATFORM_LABELS } from '@/lib/format'

/**
 * 交互式地图（Google Maps 式体验）：
 * - 自由缩放 / 拖动（geo.roam）
 * - **缩放分级**：全国层级悬停省份出概要；放大到省内才显示医院节点
 * - 点击医院节点：视角移动到该点，并展开该机构及其医生线索
 * - 坐标来源如实标注（省级近似 / 真实地理编码）
 */

type ProvinceDatum = { adcode: string; name: string; short_name: string }

export type MapHospital = {
  id: string
  name: string
  province: string
  city: string
  category: string
  level: string
  lat: number
  lng: number
  coordinateSource?: string
  leads: number
  evidenceCount: number
  doctors: string[]
}

export type MapLead = {
  id: string
  quote: string
  contextNote?: string
  doctor?: string
  stage: string
  platform: string
  publishedAt?: string
  url: string
}

type Props = {
  provinces: ProvinceDatum[]
  provinceStats: Record<string, { reports: number; hospitals: number; withEvidence: number }>
  hospitals: MapHospital[]
  leadsByHospital: Record<string, MapLead[]>
}

type ChartLike = {
  setOption: (option: unknown, notMerge?: boolean) => void
  getOption: () => { geo?: Array<{ zoom?: number; center?: number[] }> }
  resize: () => void
  dispose: () => void
  on: (event: string, handler: (params: unknown) => void) => void
}

/** 低于该缩放级别只显示省级概要；达到后才显示医院节点 */
const NODE_ZOOM_THRESHOLD = 2.2
/** 达到该级别才显示医院名称标签 */
const LABEL_ZOOM_THRESHOLD = 3.2

const STAGE_LABELS: Record<string, string> = {
  seeking: '求医中',
  consulted: '已就诊',
  assessed: '已做评估',
  diagnosed: '自称已确诊',
  treated: '已接受治疗',
  unknown: '阶段未知',
}

export function ChinaMap({ provinces, provinceStats, hospitals, leadsByHospital }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartLike | null>(null)
  const hospitalsRef = useRef(hospitals)
  hospitalsRef.current = hospitals

  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [zoom, setZoom] = useState(1.2)
  const [selected, setSelected] = useState<MapHospital | null>(null)
  const [scope, setScope] = useState<'country' | 'province'>('country')

  const provinceNameByAdcode = useMemo(() => {
    const map = new Map<string, string>()
    for (const province of provinces) map.set(province.adcode, province.short_name)
    return map
  }, [provinces])

  const readZoom = (chart: ChartLike): number => {
    const value = chart.getOption()?.geo?.[0]?.zoom
    return typeof value === 'number' ? value : 1.2
  }

  // 初始化：底图 + echarts
  useEffect(() => {
    let disposed = false
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''

    async function setup() {
      try {
        const [geoResponse, echartsModule] = await Promise.all([
          fetch(`${basePath}/geo/china-provinces.json`),
          import('echarts'),
        ])
        if (!geoResponse.ok) throw new Error(`底图加载失败：HTTP ${geoResponse.status}`)
        const geo = await geoResponse.json()
        if (disposed) return

        const echarts = echartsModule
        echarts.registerMap('traumacompass-china', geo)
        if (!containerRef.current) return

        const chart = echarts.init(containerRef.current) as unknown as ChartLike
        chartRef.current = chart

        chart.on('georoam', () => {
          const current = readZoom(chart)
          setZoom(current)
          setScope(current >= NODE_ZOOM_THRESHOLD ? 'province' : 'country')
        })

        chart.on('click', (params: unknown) => {
          const data = (params as { data?: Record<string, unknown> })?.data
          if (!data || data.kind !== 'hospital') return
          const lng = Number(data.lng)
          const lat = Number(data.lat)
          const hospital = hospitalsRef.current.find((item) => item.id === String(data.id))
          if (!hospital) return
          setSelected(hospital)
          chart.setOption({ geo: { center: [lng, lat], zoom: Math.max(readZoom(chart), 4) } })
          setZoom(Math.max(readZoom(chart), 4))
        })

        setStatus('ready')
      } catch (error) {
        if (disposed) return
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : String(error))
      }
    }

    void setup()

    const onResize = () => chartRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      chartRef.current?.dispose()
      chartRef.current = null
    }
  }, [])

  const provinceSeriesData = useMemo(
    () =>
      provinces.map((province) => ({
        name: province.name,
        value: provinceStats[province.adcode]?.hospitals ?? 0,
        adcode: province.adcode,
      })),
    [provinces, provinceStats],
  )

  const hospitalPoints = useMemo(
    () =>
      hospitals.map((hospital) => ({
        kind: 'hospital',
        id: hospital.id,
        name: hospital.name,
        lng: hospital.lng,
        lat: hospital.lat,
        value: [hospital.lng, hospital.lat, hospital.leads],
      })),
    [hospitals],
  )

  // 缩放分级 → 更新系列
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || status !== 'ready') return

    const showNodes = zoom >= NODE_ZOOM_THRESHOLD
    const showLabels = zoom >= LABEL_ZOOM_THRESHOLD

    chart.setOption(
      {
        geo: {
          map: 'traumacompass-china',
          roam: true,
          scaleLimit: { min: 1, max: 16 },
          itemStyle: { areaColor: '#eef2f8', borderColor: '#ffffff', borderWidth: 0.8 },
          emphasis: { itemStyle: { areaColor: '#dbe6f7' }, label: { show: true, fontSize: 11 } },
        },
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const data = (params as { data?: Record<string, unknown> })?.data
            if (!data || data.kind === 'hospital') return ''
            const adcode = String(data.adcode ?? '')
            const stat = provinceStats[adcode]
            const name = provinceNameByAdcode.get(adcode) ?? String(data.name ?? '')
            return [
              `<strong>${name}</strong>`,
              `线索：${stat?.reports ?? 0} 条`,
              `机构：${stat?.hospitals ?? 0} 家（其中有创伤服务证据 ${stat?.withEvidence ?? 0} 家）`,
              showNodes ? '' : '<span style="color:#8a93a0">放大到省级可查看医院节点</span>',
            ]
              .filter(Boolean)
              .join('<br/>')
          },
        },
        series: [
          { type: 'map', geoIndex: 0, data: provinceSeriesData },
          {
            name: '医院',
            type: 'scatter',
            coordinateSystem: 'geo',
            data: showNodes ? hospitalPoints : [],
            symbolSize: (value: unknown) => {
              const leads = Array.isArray(value) ? Number(value[2] ?? 0) : 0
              return Math.min(24, 10 + leads * 1.5)
            },
            itemStyle: { color: '#3763c8', borderColor: '#fff', borderWidth: 1.2, opacity: 0.92 },
            emphasis: {
              scale: 1.35,
              label: { show: true, formatter: '{b}', fontSize: 11, color: '#1b1f24' },
            },
            label: {
              show: showLabels,
              position: 'right',
              formatter: '{b}',
              fontSize: 10,
              color: '#5a6472',
            },
            zlevel: 2,
          },
        ],
      },
      false,
    )
  }, [provinceNameByAdcode, provinceSeriesData, hospitalPoints, status, zoom, provinceStats])

  const selectedLeads = selected ? (leadsByHospital[selected.id] ?? []) : []

  /** 按钮缩放：不依赖滚轮，便于触控板与可访问性；同时同步分级状态 */
  const zoomBy = (factor: number) => {
    const chart = chartRef.current
    if (!chart) return
    const next = Math.min(16, Math.max(1, readZoom(chart) * factor))
    chart.setOption({ geo: { zoom: next } })
    setZoom(next)
    setScope(next >= NODE_ZOOM_THRESHOLD ? 'province' : 'country')
  }
  const coordinateNote =
    hospitals[0]?.coordinateSource === 'geocoded'
      ? '地理编码坐标'
      : '省级近似位置（同省机构按环形展开），尚未做门址级地理编码'

  return (
    <section aria-label="全国就诊资源地图">
      <div className="tc-row tc-row--between" style={{ marginBottom: 'var(--tc-space-2)' }}>
        <div className="tc-row tc-small tc-muted">
          <span className="tc-badge tc-badge--neutral">
            {scope === 'country' ? '全国视图：悬停省份看概要' : '省级视图：点击圆点查看医院'}
          </span>
          <span>滚轮缩放 · 拖动平移 · 当前 {zoom.toFixed(1)}×</span>
        </div>
        <div className="tc-row">
          <button
            type="button"
            className="tc-button"
            aria-label="放大"
            onClick={() => zoomBy(1.6)}
          >
            ＋
          </button>
          <button
            type="button"
            className="tc-button"
            aria-label="缩小"
            onClick={() => zoomBy(1 / 1.6)}
          >
            －
          </button>
          <button
            type="button"
            className="tc-button"
            onClick={() => {
              chartRef.current?.setOption({ geo: { zoom: 1.2, center: null } })
              setZoom(1.2)
              setScope('country')
              setSelected(null)
            }}
          >
            回到全国
          </button>
        </div>
      </div>

      <div className="tc-map-layout">
        <div>
          <div ref={containerRef} className="tc-map-canvas" role="img" aria-label="全国就诊资源与线索地图" />
          {status === 'loading' && <p className="tc-small tc-muted">地图加载中……</p>}
          {status === 'error' && (
            <p className="tc-small" style={{ color: 'var(--tc-danger)' }}>
              地图加载失败：{errorMessage}（其余数据仍可正常浏览）
            </p>
          )}
          <p className="tc-small tc-faint" style={{ marginTop: 'var(--tc-space-2)' }}>
            圆点位置：{coordinateNote}。节点大小随该机构关联线索数变化。
          </p>
        </div>

        <aside className="tc-card tc-card--tight" aria-live="polite">
          {selected ? (
            <div className="tc-stack">
              <div className="tc-row tc-row--between">
                <h2 style={{ marginBottom: 0, fontSize: '1.05rem' }}>{selected.name}</h2>
                <button type="button" className="tc-button" onClick={() => setSelected(null)}>
                  关闭
                </button>
              </div>
              <p className="tc-small tc-muted" style={{ margin: 0 }}>
                {selected.province}
                {selected.city && selected.city !== selected.province ? ` · ${selected.city}` : ''} ·{' '}
                {selected.category} · {selected.level === '未知' ? '等级未标注' : selected.level}
              </p>
              <div className="tc-row tc-small">
                <span className="tc-badge tc-badge--accent">线索 {selected.leads} 条</span>
                {selected.evidenceCount > 0 && (
                  <span className="tc-badge tc-badge--neutral">机构侧证据 {selected.evidenceCount} 条</span>
                )}
              </div>
              {selected.doctors.length > 0 && (
                <p className="tc-small" style={{ margin: 0 }}>
                  线索中出现过的医生：{selected.doctors.join('、')}
                </p>
              )}
              <Link className="tc-button" href={`/hospitals/${selected.id}/`}>
                查看机构页
              </Link>

              <hr className="tc-divider" />
              <h3 style={{ marginBottom: 0 }}>就诊线索（{selectedLeads.length}）</h3>
              {selectedLeads.length === 0 ? (
                <p className="tc-small tc-faint" style={{ margin: 0 }}>
                  暂无关联线索。
                </p>
              ) : (
                selectedLeads.map((lead) => (
                  <article key={lead.id} className="tc-report" style={{ padding: 'var(--tc-space-2)' }}>
                    <div className="tc-row tc-meta">
                      <span>{PLATFORM_LABELS[lead.platform as keyof typeof PLATFORM_LABELS] ?? lead.platform}</span>
                      {lead.publishedAt && <span>· {lead.publishedAt}</span>}
                      {lead.doctor && <span>· 医生：{lead.doctor}</span>}
                      <span>· {STAGE_LABELS[lead.stage] ?? lead.stage}</span>
                    </div>
                    {lead.contextNote && (
                      <p className="tc-small tc-muted" style={{ margin: '4px 0' }}>
                        {lead.contextNote}
                      </p>
                    )}
                    <blockquote className="tc-quote" style={{ margin: '6px 0' }}>
                      「{lead.quote}」
                    </blockquote>
                    <a className="tc-small" href={lead.url} target="_blank" rel="nofollow noopener noreferrer">
                      查看原帖 ↗
                    </a>
                  </article>
                ))
              )}
            </div>
          ) : (
            <div className="tc-stack">
              <h2 style={{ marginBottom: 0, fontSize: '1.05rem' }}>怎么读这张图</h2>
              <ol className="tc-small tc-muted" style={{ margin: 0, paddingLeft: '1.2em' }}>
                <li>全国层级：鼠标放到任意省份，看该省的线索与机构概要。</li>
                <li>放大到省内（滚轮）：出现医院节点，圆点越大表示关联线索越多。</li>
                <li>点击圆点：视角移动到该医院，并在这里展开它的线索与医生。</li>
              </ol>
              <p className="tc-small tc-faint" style={{ margin: 0 }}>
                着色与圆点只反映「我们收集到多少公开信息」，既不代表当地医疗水平，也不是确诊人数统计。
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
