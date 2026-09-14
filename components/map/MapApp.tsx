'use client'

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Marker, Map as LeafletMap, LayerGroup, GeoJSON as LeafletGeoJSON, GeoJSON as GeoJSONTypes, Point } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { hospitalSearchText, matchesSearch } from '@/lib/search'
import type { Disorder, Hospital, Province, Report } from '@/lib/schema'
import { HospitalExplorer } from '@/components/HospitalExplorer'
import { ReportExplorer } from '@/components/ReportExplorer'
import { Sidebar, type SidebarTabId } from './Sidebar'
import { DoctorExplorer } from './DoctorExplorer'
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
const MAX_ZOOM = 12
const HOME_VIEW: [number, number, number] = [35.5, 105, 4]
const NO_DATA_COLOR = '#ffffff'

function densityColor(reports: number): string {
  if (reports <= 0) return NO_DATA_COLOR
  if (reports <= 2) return '#d4eadd'
  if (reports <= 4) return '#a8d4ba'
  if (reports <= 7) return '#76b89a'
  if (reports <= 10) return '#43977a'
  return '#23856b'
}

function nodeRadius(leads: number): number {
  return 5 + Math.min(5, Math.sqrt(leads) * 1.4)
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
  const markersRef = useRef<Array<{ marker: Marker; name: string; id: string }>>([])
  const zoomRef = useRef(HOME_VIEW[2])
  const summaryRef = useRef<LayerGroup | null>(null)
  const animationRef = useRef<number | null>(null)
  const nodesOnRef = useRef(false)
  const propsRef = useRef(props)
  propsRef.current = props

  const [zoom, setZoom] = useState(HOME_VIEW[2])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [selectedProvinceAdcode, setSelectedProvinceAdcode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mapError, setMapError] = useState('')
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize({ pan: false }))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const tileKey = process.env.NEXT_PUBLIC_TIANDITU_KEY
  const geocodedCount = props.mapHospitals.filter((h) => h.coordinateSource === 'geocoded').length
  const coordinateNote = geocodedCount === 0
    ? '省级示意，非医院地址'
    : geocodedCount === props.mapHospitals.length
      ? '位置来自公开地图 POI 匹配'
      : `${geocodedCount} 家为公开地图 POI 位置，其余为省级示意`

  const moveTo = (lat: number, lng: number, targetZoom: number) => {
    const map = mapRef.current
    if (!map) return
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
    map.stop()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.setView([lat, lng], targetZoom, { animate: false })
      return
    }
    const z = map.getZoom(), start = map.project(map.getCenter(), 0), end = map.project([lat, lng], 0)
    const started = performance.now()
    const frame = (now: number) => {
      try {
        const t = Math.min(1, (now - started) / 1100)
        const e = t * t * t * (t * (6 * t - 15) + 10)
        map.setView(map.unproject(start.add(end.subtract(start).multiplyBy(e)), 0), z + (targetZoom - z) * e, { animate: false })
        animationRef.current = t < 1 ? requestAnimationFrame(frame) : null
      } catch (error) {
        console.error('moveTo frame error', error)
        animationRef.current = null
      }
    }
    animationRef.current = requestAnimationFrame(frame)
  }

  useEffect(() => {
    for (const { marker, id } of markersRef.current) {
      const active = id === selectedHospitalId
      marker.getElement()?.classList.toggle('tc-pin--selected', active)
      marker.setZIndexOffset(active ? 1000 : 0)
      if (active) marker.openTooltip()
      else marker.closeTooltip()
    }
  }, [selectedHospitalId, zoom])

  /** 选中医院：飞过去 + 侧栏切详情卡 */
  const selectHospital = (id: string) => {
    const hospital = propsRef.current.mapHospitals.find((item) => item.id === id)
    if (!hospital) return
    setSelectedHospitalId(id)
    setSelectedProvinceAdcode(null)
    setSidebarOpen(true)
    const map = mapRef.current
    if (map) moveTo(hospital.lat, hospital.lng, Math.max(map.getZoom(), 8))
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
    const fitZoom = map.getBoundsZoom(layerBounds)
    const center = layerBounds.getCenter()
    moveTo(center.lat, center.lng, Math.min(MAX_ZOOM, Math.max(fitZoom, NODE_ZOOM_THRESHOLD)))
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
      // 省份填充随层级切换：全国=密度着色，省级=淡出描边
      if (showNodes) summaryRef.current?.remove()
      else summaryRef.current?.addTo(currentMap)
      geoLayer.resetStyle()
      geoLayer.eachLayer((layer) => {
        if (showNodes) layer.closeTooltip()
        const element = (layer as unknown as { getElement?: () => SVGElement }).getElement?.()
        if (element) element.style.pointerEvents = showNodes ? 'none' : 'auto'
      })
    }

    async function setup() {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
        const L = await import('leaflet')
        if (disposed || !containerRef.current) return

        map = L.map(containerRef.current, {
          center: [HOME_VIEW[0], HOME_VIEW[1]],
          zoom: HOME_VIEW[2],
          zoomSnap: 0,
          zoomDelta: 0.5,
          minZoom: 4,
          maxBounds: [[3, 65], [57, 142]],
          maxBoundsViscosity: 1,
          maxZoom: MAX_ZOOM,
          zoomControl: false,
        })
        mapRef.current = map
        L.control.zoom({ position: 'bottomright' }).addTo(map)

        // 地图容器是 overflow:hidden，但浏览器仍可被 scrollIntoView 滚动它
        // （如页面内 Ctrl+F 命中省份名、或控件获焦），一旦滚动，缩放控件会位移到视口中间而点不到。
        // 这里把滚动位置钉回原点，保证控件始终停在右下角。
        const mapContainer = containerRef.current
        const pinToOrigin = () => {
          if (mapContainer.scrollTop !== 0) mapContainer.scrollTop = 0
          if (mapContainer.scrollLeft !== 0) mapContainer.scrollLeft = 0
        }
        mapContainer.addEventListener('scroll', pinToOrigin, { passive: true })
        mapContainer.addEventListener('focusin', pinToOrigin)
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
          const marker = L.marker([hospital.lat, hospital.lng], {
            icon: L.divIcon({ className: 'tc-hospital-pin', html: '<span class="tc-pin-body">✚</span>', iconSize: [44, 48], iconAnchor: [22, 44], tooltipAnchor: [22, -24] }),
            title: hospital.name, alt: hospital.name, riseOnHover: true,
          })
          const label = document.createElement('span')
          label.textContent = hospital.name
          marker.bindTooltip(label, { permanent: false, direction: 'right', className: 'tc-node-label' })
          marker.on('click', () => selectHospital(hospital.id))
          return { marker, name: hospital.name, id: hospital.id }
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
            const count = propsRef.current.provinceStats[adcode]?.reports ?? 0
            const detailed = zoomRef.current >= NODE_ZOOM_THRESHOLD
            return { color: '#a3b6aa', weight: 0.7, fillColor: densityColor(count), fillOpacity: detailed ? 0.04 : count ? 0.5 : 0.92 }

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
            layer.on('click', () => { if (zoomRef.current < NODE_ZOOM_THRESHOLD) selectProvince(adcode) })
            layer.on('mouseover', () => { if (zoomRef.current >= NODE_ZOOM_THRESHOLD) layer.closeTooltip() })
          },
        }).addTo(map)
        geoLayerRef.current = geoLayer

        const summaries = geo.features.flatMap(feature => {
          const adcode = String(feature.properties?.adcode ?? '')
          const stat = propsRef.current.provinceStats[adcode]
          const center = feature.properties?.centroid ?? feature.properties?.center
          if (!stat || stat.reports > 0 || !Array.isArray(center)) return []
          const content = document.createElement('span')
          content.className = 'tc-region-unknown'
          const name = document.createElement('small')
          name.textContent = propsRef.current.provinces.find(p => p.adcode === adcode)?.short_name ?? ''
          const count = document.createElement('strong')
          count.textContent = '?'
          count.setAttribute('aria-label', '暂无收录')
          content.append(name, count)
          const marker = L.marker([center[1], center[0]], { icon: L.divIcon({ className: 'tc-region-marker', html: content, iconSize: [56, 56], iconAnchor: [28, 28] }), title: `${name.textContent} · ${stat.reports} 条线索` })
          marker.on('click', () => selectProvince(adcode))
          return [marker]
        })
        summaryRef.current = L.layerGroup(summaries).addTo(map)
        const interrupt = () => { if (animationRef.current !== null) cancelAnimationFrame(animationRef.current) }
        map.on('dragstart', interrupt)
        map.getContainer().addEventListener('wheel', interrupt, { passive: true })
        map.on('zoomend', applyZoomStyles)
        applyZoomStyles()
      } catch (error) {
        if (!disposed) setMapError(error instanceof Error ? error.message : String(error))
      }
    }

    void setup()
    return () => {
      disposed = true
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
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
    moveTo(...HOME_VIEW)
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
      const haystack = hospitalSearchText(hospital, propsRef.current.reports)
      if (matchesSearch(haystack, q)) {
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
          reports={props.reports}
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
    doctors: (
      <DoctorExplorer hospitals={props.hospitals} reports={props.reports} onSelectHospital={selectHospital} />
    ),
    submit: (
      <div className="tc-stack">
        <h3>提交线索</h3>
        <p className="tc-small tc-muted">提供公开原帖链接，以及医院、科室或医生线索即可。请勿提交病历、联系方式或其他个人信息。</p>
        <a className="tc-button tc-button--active" href="https://github.com/XhoIeph/TraumaCompass/issues/new?template=lead.yml" target="_blank" rel="noopener noreferrer">在 GitHub 提交线索 ↗</a>
        <p className="tc-meta">需要 GitHub 账号。提交后内容将公开可见。</p>
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
          {scope === 'country' ? '探索就诊线索' : '点击图钉查看机构'}
        </span>
      </div>

      {sidebarOpen && <div className="tc-mapapp-backdrop" onClick={() => setSidebarOpen(false)} />}

      <Sidebar open={sidebarOpen} tabs={tabs} detail={detailNode} totals={props.totals} />

      <div className="tc-project-corner">
        <button type="button" className="tc-mapapp-ctl" aria-expanded={aboutOpen} onClick={() => setAboutOpen(v => !v)}>关于项目</button>
        {aboutOpen && <section className="tc-project-card" aria-label="关于项目">
          <div className="tc-row tc-row--between"><strong>TraumaCompass</strong><button className="tc-linklike" onClick={() => setAboutOpen(false)}>关闭</button></div>
          <p>整理 CPTSD / BPD 就诊线索，让医院、医生与就诊经历更容易找到。</p>
          <p className="tc-meta">仅供信息参考，不提供医疗建议。</p>
          <a href="https://github.com/XhoIeph/TraumaCompass" target="_blank" rel="noopener noreferrer">项目仓库 ↗</a>
        </section>}
      </div>
      <details className="tc-mapapp-legend"><summary>图例与位置说明</summary>
        <p>色块表示各省收录条数，不代表就诊人数。</p>
        <div className="tc-density-key">{[["#d4eadd", "1–2"], ["#a8d4ba", "3–4"], ["#76b89a", "5–7"], ["#43977a", "8–10"], ["#23856b", "11+"]].map(([color,label]) => <span key={label}><i style={{background:color}} />{label}</span>)}</div>
        <p>白色 ?：暂无收录。十字图钉：医院。</p>
        <p>图钉位置：{coordinateNote}。</p>
        {!tileKey && <p>示意底图 · 非标准地图</p>}
      </details>

      <div className="tc-mapapp-actions">
        <button type="button" className="tc-mapapp-ctl" onClick={backToCountry} title="回到全国视图">
          回到全国
        </button>
      </div>
    </div>
  )
}
