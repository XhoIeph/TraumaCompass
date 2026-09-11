'use client'

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CircleMarker, Map as LeafletMap, LayerGroup, GeoJSON as LeafletGeoJSON, GeoJSON as GeoJSONTypes, Point } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import type { Disorder, Hospital, Province, Report } from '@/lib/schema'
import { HospitalExplorer } from '@/components/HospitalExplorer'
import { ReportExplorer } from '@/components/ReportExplorer'
import { Sidebar, type SidebarTabId } from './Sidebar'
import { HospitalDetail } from './HospitalDetail'
import { ProvinceDetail } from './ProvinceDetail'
import type { MapHospital, MapLead, MapProvinceStat } from './types'

/**
 * 全页地图应用（Google Maps 式）：
 * - 底图：天地图瓦片（需 NEXT_PUBLIC_TIANDITU_KEY）；未配置 key 时回退为省界矢量示意底图
 * - 密度：全国层级按省级线索条数着色（choropleth），放大到省级后淡出、显示医院节点
 * - 侧栏：机构 / 线索 / 关于 / 投稿；点省份或医院节点切换成详情卡
 * - 诚实标注：密度是「公开线索的采集密度」，不是就诊/确诊人数；节点坐标是省级近似
 */

const NODE_ZOOM_THRESHOLD = 7
const LABEL_ZOOM_THRESHOLD = 9
const MAX_ZOOM = 12
const HOME_VIEW: [number, number, number] = [35.5, 105, 4.5]
const NO_DATA_COLOR = '#e3e7ee'

function densityColor(reports: number): string {
  if (reports <= 0) return NO_DATA_COLOR
  if (reports <= 2) return '#cdddf6'
  if (reports <= 4) return '#a5c4f0'
  if (reports <= 7) return '#7aa7e6'
  if (reports <= 10) return '#5487d8'
  return '#3763c8'
}

function nodeRadius(leads: number): number {
  return 5 + Math.min(11, leads * 1.2)
}

type Props = {
  provinces: Province[]
  mapHospitals: MapHospital[]
  leadsByHospital: Record<string, MapLead[]>
  provinceStats: Record<string, MapProvinceStat>
  totals: { reports: number; hospitals: number; provincesWithReports: number }
  hospitals: Hospital[]
  reports: Report[]
  disorders: Disorder[]
  visibleDisorders: Disorder[]
  reportProvince: Record<string, string>
  hospitalNames: Record<string, string>
  reportCounts: Record<string, number>
}

type SearchResult = {
  key: string
  label: string
  sub: string
  run: () => void
}

export function MapApp(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const geoLayerRef = useRef<LeafletGeoJSON | null>(null)
  const nodeLayerRef = useRef<LayerGroup | null>(null)
  const markersRef = useRef<Array<{ marker: CircleMarker; name: string }>>([])
  const zoomRef = useRef(HOME_VIEW[2])
  const labelsOnRef = useRef(false)
  const nodesOnRef = useRef(false)
  const propsRef = useRef(props)
  propsRef.current = props

  const [zoom, setZoom] = useState(HOME_VIEW[2])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [selectedProvinceAdcode, setSelectedProvinceAdcode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mapError, setMapError] = useState('')

  const tileKey = process.env.NEXT_PUBLIC_TIANDITU_KEY
  const coordinateNote = props.mapHospitals[0]?.coordinateSource === 'geocoded'
    ? '真实地理编码坐标'
    : '省级近似位置（同省机构按环形展开），尚未做门址级地理编码'

  /** 选中医院：飞过去 + 侧栏切详情卡 */
  const selectHospital = (id: string) => {
    const hospital = propsRef.current.mapHospitals.find((item) => item.id === id)
    if (!hospital) return
    setSelectedHospitalId(id)
    setSelectedProvinceAdcode(null)
    setSidebarOpen(true)
    const map = mapRef.current
    map?.flyTo([hospital.lat, hospital.lng], Math.max(map.getZoom(), 8.5), { duration: 0.8 })
  }

  /** 选中省份：飞到省界范围 + 侧栏切省份概要卡 */
  const selectProvince = (adcode: string) => {
    setSelectedProvinceAdcode(adcode)
    setSelectedHospitalId(null)
    setSidebarOpen(true)
    const map = mapRef.current
    const geoLayer = geoLayerRef.current
    if (!map || !geoLayer) return
    const target = geoLayer
      .getLayers()
      .find(
        (layer) =>
          String(
            (layer as unknown as { feature?: GeoJSON.Feature }).feature?.properties?.adcode ?? '',
          ) === adcode,
      )
    if (!target) return
    // 强制提到节点阈值：省份再大也不能停在「全国视图」缩放级别
    const layerBounds = (target as GeoJSONTypes).getBounds()
    const fitZoom = map.getBoundsZoom(layerBounds, false, [48, 48] as unknown as Point)
    map.flyTo(
      layerBounds.getCenter(),
      Math.min(MAX_ZOOM, Math.max(fitZoom, NODE_ZOOM_THRESHOLD)),
      { duration: 0.8 },
    )
  }

  // 初始化 Leaflet：底图（瓦片或矢量回退）+ 省界密度层 + 医院节点层
  useEffect(() => {
    let disposed = false
    let map: LeafletMap | undefined

    const applyZoomStyles = () => {
      const currentMap = mapRef.current
      const geoLayer = geoLayerRef.current
      const nodeLayer = nodeLayerRef.current
      if (!currentMap || !geoLayer || !nodeLayer) return

      const z = currentMap.getZoom()
      zoomRef.current = z
      setZoom(z)

      const showNodes = z >= NODE_ZOOM_THRESHOLD
      if (showNodes !== nodesOnRef.current) {
        nodesOnRef.current = showNodes
        if (showNodes) nodeLayer.addTo(currentMap)
        else nodeLayer.remove()
      }
      const showLabels = z >= LABEL_ZOOM_THRESHOLD
      if (showLabels !== labelsOnRef.current) {
        labelsOnRef.current = showLabels
        for (const { marker, name } of markersRef.current) {
          marker.unbindTooltip()
          marker.bindTooltip(name, { permanent: showLabels, direction: 'right', className: 'tc-node-label' })
        }
      }
      // 省份填充随层级切换：全国=密度着色，省级=淡出描边
      geoLayer.resetStyle()
    }

    async function setup() {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
        const L = await import('leaflet')
        if (disposed || !containerRef.current) return

        map = L.map(containerRef.current, {
          center: [HOME_VIEW[0], HOME_VIEW[1]],
          zoom: HOME_VIEW[2],
          zoomSnap: 0.5,
          zoomDelta: 0.5,
          minZoom: 3.5,
          maxZoom: MAX_ZOOM,
          zoomControl: false,
        })
        mapRef.current = map
        L.control.zoom({ position: 'bottomright' }).addTo(map)
        L.control.scale({ position: 'bottomright', imperial: false }).addTo(map)

        if (tileKey) {
          const commons = {
            subdomains: '01234567',
            maxZoom: MAX_ZOOM,
            tileSize: 256,
          }
          L.tileLayer(
            `https://t{s}.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=${tileKey}`,
            {
              ...commons,
              attribution:
                '底图 © <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">国家地理信息公共服务平台 天地图</a>',
            },
          ).addTo(map)
          L.tileLayer(
            `https://t{s}.tianditu.gov.cn/DataServer?T=cia_w&x={x}&y={y}&l={z}&tk=${tileKey}`,
            { ...commons, opacity: 0.85 },
          ).addTo(map)
        }

        const geoResponse = await fetch(`${basePath}/geo/china-provinces.json`)
        if (!geoResponse.ok) throw new Error(`省界底图加载失败：HTTP ${geoResponse.status}`)
        const geo = (await geoResponse.json()) as GeoJSON.FeatureCollection
        if (disposed || !mapRef.current) return

        // 医院节点层（初始隐藏，放大到省级才加入地图）
        const markers = propsRef.current.mapHospitals.map((hospital) => {
          const marker = L.circleMarker([hospital.lat, hospital.lng], {
            radius: nodeRadius(hospital.leads),
            color: '#ffffff',
            weight: 1.5,
            fillColor: '#3763c8',
            fillOpacity: 0.92,
          })
          marker.bindTooltip(hospital.name, { permanent: false, direction: 'right', className: 'tc-node-label' })
          marker.on('click', () => selectHospital(hospital.id))
          return { marker, name: hospital.name }
        })
        markersRef.current = markers
        nodeLayerRef.current = L.layerGroup(markers.map((item) => item.marker))

        // 省界层：密度 choropleth + 悬停概要 + 点击进详情
        const geoLayer = L.geoJSON(geo, {
          style: (feature) => {
            const adcode = String(feature?.properties?.adcode ?? '')
            if (adcode.endsWith('_JD')) {
              return { color: '#8a93a0', weight: 1, dashArray: '4 3', fill: false }
            }
            const z = zoomRef.current
            const stat = propsRef.current.provinceStats[adcode]
            if (z >= NODE_ZOOM_THRESHOLD) {
              return { color: '#7d97c8', weight: 1, fillColor: '#dfe7f3', fillOpacity: 0.25 }
            }
            return { color: '#ffffff', weight: 1, fillColor: densityColor(stat?.reports ?? 0), fillOpacity: 0.72 }
          },
          onEachFeature: (feature, layer) => {
            const adcode = String(feature?.properties?.adcode ?? '')
            if (adcode.endsWith('_JD')) {
              layer.on('click', (event) => L.DomEvent.stopPropagation(event))
              return
            }
            const stat = propsRef.current.provinceStats[adcode]
            const name = String(feature?.properties?.name ?? '')
            layer.bindTooltip(
              [
                `<strong>${name}</strong>`,
                `线索：${stat?.reports ?? 0} 条`,
                `机构：${stat?.hospitals ?? 0} 家（其中有创伤服务证据 ${stat?.withEvidence ?? 0} 家）`,
              ].join('<br/>'),
              { sticky: true, className: 'tc-province-tip' },
            )
            layer.on('click', () => selectProvince(adcode))
          },
        }).addTo(map)
        geoLayerRef.current = geoLayer

        map.on('zoomend', applyZoomStyles)
        applyZoomStyles()
      } catch (error) {
        if (!disposed) setMapError(error instanceof Error ? error.message : String(error))
      }
    }

    void setup()
    return () => {
      disposed = true
      map?.remove()
      mapRef.current = null
      geoLayerRef.current = null
      nodeLayerRef.current = null
      markersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const backToCountry = () => {
    setSelectedHospitalId(null)
    setSelectedProvinceAdcode(null)
    mapRef.current?.flyTo([HOME_VIEW[0], HOME_VIEW[1]], HOME_VIEW[2], { duration: 0.8 })
  }

  // 搜索：省份（名称/简称）+ 机构（名称/别名/城市）
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = query.trim()
    if (!q) return []
    const results: SearchResult[] = []
    for (const province of propsRef.current.provinces) {
      if (province.name.includes(q) || province.short_name.includes(q)) {
        results.push({
          key: `province-${province.adcode}`,
          label: province.name,
          sub: '省份概要',
          run: () => selectProvince(province.adcode),
        })
      }
      if (results.length >= 4) break
    }
    for (const hospital of propsRef.current.hospitals) {
      const haystack = [hospital.name, ...hospital.aliases, hospital.city, hospital.province].join(' ')
      if (haystack.includes(q)) {
        results.push({
          key: `hospital-${hospital.id}`,
          label: hospital.name,
          sub: `${hospital.province} ${hospital.city} · 线索 ${propsRef.current.reportCounts[hospital.id] ?? 0} 条`,
          run: () => selectHospital(hospital.id),
        })
      }
      if (results.length >= 10) break
    }
    return results
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const selectedHospital = props.mapHospitals.find((item) => item.id === selectedHospitalId) ?? null
  const selectedProvince = props.provinces.find((item) => item.adcode === selectedProvinceAdcode) ?? null
  const selectedLeads = selectedHospital ? (props.leadsByHospital[selectedHospital.id] ?? []) : []

  const detailNode = selectedHospital ? (
    <HospitalDetail
      hospital={selectedHospital}
      leads={selectedLeads}
      onClose={() => setSelectedHospitalId(null)}
      onLocate={() => selectHospital(selectedHospital.id)}
    />
  ) : selectedProvince ? (
    <ProvinceDetail
      provinceName={selectedProvince.name}
      adcode={selectedProvince.adcode}
      stat={props.provinceStats[selectedProvince.adcode]}
      hospitals={props.mapHospitals.filter((item) => item.adcode === selectedProvince.adcode)}
      onClose={() => setSelectedProvinceAdcode(null)}
      onZoomToProvince={() => selectProvince(selectedProvince.adcode)}
      onSelectHospital={selectHospital}
    />
  ) : null

  const tabs: Record<SidebarTabId, ReactNode> = {
    hospitals: (
      <Suspense fallback={<p className="tc-small tc-muted">加载中……</p>}>
        <HospitalExplorer
          hospitals={props.hospitals}
          provinces={props.provinces}
          reportCounts={props.reportCounts}
          variant="compact"
          onSelectHospital={selectHospital}
        />
      </Suspense>
    ),
    reports: (
      <Suspense fallback={<p className="tc-small tc-muted">加载中……</p>}>
        <ReportExplorer
          reports={props.reports}
          disorders={props.disorders}
          provinces={props.provinces}
          reportProvince={props.reportProvince}
          hospitalNames={props.hospitalNames}
          variant="compact"
          onSelectHospital={selectHospital}
        />
      </Suspense>
    ),
    about: (
      <div className="tc-stack">
        <div>
          <h3>这个项目在做什么</h3>
          <p className="tc-small tc-muted">
            本站收集两类公开信息：有公开依据的创伤相关服务机构，以及网友自述的就诊路径（医院、医生、流程、费用）。
          </p>
        </div>
        <div>
          <h3>首期收录的诊断</h3>
          <div className="tc-row">
            {props.visibleDisorders.map((disorder) => (
              <span key={disorder.id} className="tc-badge tc-badge--accent" title={disorder.summary}>
                {disorder.name_zh}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3>读图须知</h3>
          <ul className="tc-small tc-muted" style={{ margin: 0, paddingLeft: '1.2em' }}>
            <li>密度颜色是「公开线索的采集密度」，不是就诊或确诊人数统计，条数不代表医疗水平。</li>
            <li>医院节点位置：{coordinateNote}。</li>
            <li>线索均为公开平台自述摘录，逐条附原帖链接；本站不提供诊断或治疗建议。</li>
          </ul>
        </div>
        <p className="tc-small">
          <Link href="/about/">查看完整的方法论、数据字典与撤下流程 →</Link>
        </p>
      </div>
    ),
    submit: (
      <div className="tc-stack">
        <h3>提交线索</h3>
        <p className="tc-small tc-muted">
          如果你知道公开平台上关于 CPTSD / BPD 就诊经历的帖子（医院、科室、医生、流程、费用），
          欢迎提交。收录标准：公开可见、可附原链接、摘录 ≤200 字；不采集用户名与 IP 属地。
        </p>
        <p className="tc-small">
          <Link href="/submit/">前往投稿页查看详细指引 →</Link>
        </p>
      </div>
    ),
  }

  const scope = zoom >= NODE_ZOOM_THRESHOLD ? 'province' : 'country'

  return (
    <div className={`tc-mapapp${sidebarOpen ? ' tc-mapapp--open' : ''}`}>
      <div ref={containerRef} className="tc-mapapp-canvas" role="application" aria-label="全国就诊资源与线索地图" />
      {mapError && (
        <div className="tc-mapapp-error" role="alert">
          地图加载失败：{mapError}（其余数据仍可在侧边栏浏览）
        </div>
      )}

      <div className="tc-mapapp-topbar">
        <button
          type="button"
          className="tc-mapapp-burger"
          aria-label={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          aria-expanded={sidebarOpen}
          onClick={() => setSidebarOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="tc-mapapp-search">
          <input
            type="search"
            value={query}
            placeholder="搜索省份或机构名称"
            aria-label="搜索省份或机构名称"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                searchResults[0]?.run()
                setQuery('')
              }
              if (event.key === 'Escape') setQuery('')
            }}
          />
          {searchResults.length > 0 && (
            <ul className="tc-mapapp-results">
              {searchResults.map((result) => (
                <li key={result.key}>
                  <button
                    type="button"
                    onClick={() => {
                      result.run()
                      setQuery('')
                    }}
                  >
                    <strong>{result.label}</strong>
                    <small>{result.sub}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="tc-badge tc-badge--neutral tc-mapapp-scope">
          {scope === 'country' ? '全国视图：点击省份看概要' : '省级视图：点击圆点看医院'}
        </span>
      </div>

      {sidebarOpen && <div className="tc-mapapp-backdrop" onClick={() => setSidebarOpen(false)} />}

      <Sidebar open={sidebarOpen} tabs={tabs} detail={detailNode} totals={props.totals} />

      <div className="tc-mapapp-legend">
        <strong>就诊线索密度（按省）</strong>
        <div className="tc-legend-ramp">
          <span className="tc-swatch" style={{ background: NO_DATA_COLOR }} />
          <span>暂无记录</span>
          <span className="tc-ramp" aria-hidden="true" />
          <span>线索少 → 多</span>
        </div>
        <p>
          颜色深浅是公开线索的<strong>采集密度</strong>，不是就诊或确诊人数统计，也不代表当地医疗水平。
        </p>
        <p className="tc-faint">
          医院节点位置：{coordinateNote}。点击省份看概要，放大后出现医院节点。
        </p>
        {!tileKey && (
          <p className="tc-faint">当前为示意底图（省界数据，非标准地图）；配置天地图 key 后显示真实地图。</p>
        )}
      </div>

      <div className="tc-mapapp-actions">
        <button type="button" className="tc-mapapp-ctl" onClick={backToCountry} title="回到全国视图">
          回到全国
        </button>
      </div>
    </div>
  )
}
