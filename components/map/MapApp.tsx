'use client'

import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Marker, Map as LeafletMap, LayerGroup, GeoJSON as LeafletGeoJSON, GeoJSON as GeoJSONTypes } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'
import { hospitalSearchText, matchesSearch } from '@/lib/search'
import { aggregateDoctorLeads } from '@/lib/doctor-leads'
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
 * - 节点：zoom ≥ 7 才出现；7–9 聚合近邻医院（十字 + 数量角标，点击放大）；≥ 10 展开为单个图钉
 * - 侧栏：<1000px 默认关闭（首屏先看到地图），≥1000px 默认展开；移动端按 modal drawer 处理焦点
 * - 诚实标注：密度是「公开线索的采集密度」，不是就诊/确诊人数；节点坐标为公开地图 POI 或省级示意
 */

const NODE_ZOOM_THRESHOLD = 7
/** 达到该层级展开为单个图钉，之前做近邻聚合 */
const CLUSTER_MAX_ZOOM = 10
/** 聚合网格边长（像素） */
const CLUSTER_PIXEL = 56
const MAX_ZOOM = 12
/** 中国主体范围（不含南海诸岛之外的远海），用于初始 fitBounds */
const CHINA_BOUNDS: [[number, number], [number, number]] = [
  [17.5, 73.0],
  [53.8, 135.5],
]
const NO_DATA_COLOR = '#ffffff'

function densityColor(reports: number): string {
  if (reports <= 0) return NO_DATA_COLOR
  if (reports <= 2) return '#b9e6c8'
  if (reports <= 4) return '#7dd3a4'
  if (reports <= 7) return '#4dbb83'
  if (reports <= 10) return '#2f9e68'
  return '#147a52'
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

type SearchGroup = '省份' | '机构' | '医生' | '病症'

type SearchResult = {
  key: string
  group: SearchGroup
  label: string
  sub: string
  run: () => void
}

/** 聚合后的节点：clustered=false 时必须只有一个成员 */
type NodeEntry = {
  key: string
  lat: number
  lng: number
  members: MapHospital[]
}

export function MapApp(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const geoLayerRef = useRef<LeafletGeoJSON | null>(null)
  const nodeLayerRef = useRef<LayerGroup | null>(null)
  const clusterLayerRef = useRef<LayerGroup | null>(null)
  const nodesOnRef = useRef(false)
  const zoomRef = useRef(NODE_ZOOM_THRESHOLD)
  const propsRef = useRef(props)
  propsRef.current = props
  const sidebarRef = useRef<HTMLElement | null>(null)
  const burgerRef = useRef<HTMLButtonElement | null>(null)
  const desktopRef = useRef(false)

  const [zoom, setZoom] = useState(NODE_ZOOM_THRESHOLD)
  // 首屏以「地图优先」为准：服务端与移动端都先关闭侧栏，挂载后再按断点决定
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null)
  const [selectedProvinceAdcode, setSelectedProvinceAdcode] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mapError, setMapError] = useState('')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [activeResult, setActiveResult] = useState(-1)
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('hospitals')
  /** 全局搜索命中病症时，把该病症注入线索列表筛选 */
  const [seedDisorder, setSeedDisorder] = useState<string | undefined>(undefined)

  const selectedRef = useRef<string | null>(null)
  selectedRef.current = selectedHospitalId

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize({ pan: false }))
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  /** 断点：≥1000px 默认展开侧栏；<1000px 默认关闭（首屏必须看到地图） */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1000px)')
    const apply = () => {
      desktopRef.current = mq.matches
      setIsDesktop(mq.matches)
      setSidebarOpen(mq.matches)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  /** 移动端抽屉：焦点进入、Escape 关闭并回到触发按钮（真 modal 行为） */
  useEffect(() => {
    if (!sidebarOpen || isDesktop) return
    const panel = sidebarRef.current
    // 焦点优先落在当前标签（这样 ←/→ 可立即切换），没有标签（详情卡）时退回第一个可聚焦元素
    const activeTab = panel?.querySelector<HTMLElement>('.tc-sidebar-tab[tabindex="0"]')
    const fallback = panel?.querySelector<HTMLElement>(
      'button, a[href], input, select, [tabindex]:not([tabindex="-1"])',
    )
    ;(activeTab ?? fallback)?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setSidebarOpen(false)
      burgerRef.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [sidebarOpen, isDesktop])

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
    // 天地图由底图与注记两层栅格瓦片组成。停在小数缩放级别时两层都会
    // 长期处于浏览器插值缩放状态，文字边缘会像重影；程序化移动统一落到整数级。
    const crispZoom = Math.round(targetZoom)
    map.stop()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.setView([lat, lng], crispZoom, { animate: false })
      return
    }
    // 原生 flyTo 在动画中只移动现有图层，动画结束后才触发 zoomend，
    // 避免每一帧清空并重建聚合图钉造成频闪和瞬移。
    map.flyTo([lat, lng], crispZoom, { animate: true, duration: 0.85 })
  }

  /** 选中医院：飞过去 + 侧栏切详情卡 */
  const selectHospital = (id: string) => {
    const hospital = propsRef.current.mapHospitals.find((item) => item.id === id)
    if (!hospital) return
    setSelectedHospitalId(id)
    setSelectedProvinceAdcode(null)
    setSidebarOpen(true)
    const map = mapRef.current
    if (map) moveTo(hospital.lat, hospital.lng, Math.max(map.getZoom(), CLUSTER_MAX_ZOOM))
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
    const layerBounds = (target as GeoJSONTypes).getBounds()
    const fitZoom = map.getBoundsZoom(layerBounds)
    const center = layerBounds.getCenter()
    moveTo(center.lat, center.lng, Math.min(MAX_ZOOM, Math.max(fitZoom, NODE_ZOOM_THRESHOLD)))
  }

  // 初始化 Leaflet：底图（瓦片或矢量回退）+ 省界密度层 + 节点层
  useEffect(() => {
    let disposed = false
    let map: LeafletMap | undefined

    async function setup() {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
        const L = await import('leaflet')
        if (disposed || !containerRef.current) return

        map = L.map(containerRef.current, {
          center: [35.5, 105],
          zoom: 4,
          // 栅格底图必须在整数级结束缩放，否则底图与注记层会持续被缩放插值，
          // 在高 DPI 屏幕上尤其容易出现文字与道路的重影。
          zoomSnap: 1,
          zoomDelta: 1,
          fadeAnimation: false,
          // 竖屏手机上装下整个中国所需的缩放级别低于 4；minZoom 过高会把国土裁掉，
          // 因此下限压到 3，让 fitBounds 决定初始视野；maxBounds 放宽，避免与 fit 互相打架
          minZoom: 3,
          maxBounds: [[-5, 55], [65, 155]],
          maxBoundsViscosity: 1,
          maxZoom: MAX_ZOOM,
          zoomControl: false,
          // 用 fitBounds 控制初始视野（按侧栏是否展开设置左右 padding）
          attributionControl: true,
        })
        mapRef.current = map
        L.control.zoom({ position: 'bottomright' }).addTo(map)
        L.control.scale({ position: 'bottomright', imperial: false }).addTo(map)

        /** 初始与「回到全国」共用：按侧栏状态给出合适的 padding，保证中国主体完整可见 */
        const fitCountry = (withSidebar: boolean) => {
          if (!map) return
          const wide = window.innerWidth >= 1000
          const left = withSidebar && desktopRef.current ? 384 : 12
          // 窄屏上下留白压到最小：竖屏装下整幅国土后本就会出现南北邻国，
          // 不再额外加 padding，让中国尽量占满可用宽度
          map.fitBounds(L.latLngBounds(CHINA_BOUNDS[0], CHINA_BOUNDS[1]), {
            paddingTopLeft: [left, wide ? 76 : 58],
            paddingBottomRight: [12, wide ? 96 : 64],
            animate: false,
          })
          zoomRef.current = map.getZoom()
        }
        fitCountry(desktopRef.current)

        // 地图容器是 overflow:hidden，但浏览器仍可被 scrollIntoView 滚动它
        const mapContainer = containerRef.current
        const pinToOrigin = () => {
          if (mapContainer.scrollTop !== 0) mapContainer.scrollTop = 0
          if (mapContainer.scrollLeft !== 0) mapContainer.scrollLeft = 0
        }
        mapContainer.addEventListener('scroll', pinToOrigin, { passive: true })
        mapContainer.addEventListener('focusin', pinToOrigin)

        if (tileKey) {
          const commons = {
            subdomains: '01234567',
            maxZoom: MAX_ZOOM,
            tileSize: 256,
            // flyTo 过程中沿用同一组瓦片，结束后一次性切换到目标级别，
            // 避免底图与注记层各自刷新造成短暂的双层残影。
            updateWhenZooming: false,
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

        nodeLayerRef.current = L.layerGroup()
        clusterLayerRef.current = L.layerGroup()
        ;(mapRef.current as unknown as { __fitCountry?: (withSidebar: boolean) => void }).__fitCountry = fitCountry

        /** 生成单个医院图钉（可访问名称 = 医院名） */
        const createPin = (hospital: MapHospital, latOffset = 0, lngOffset = 0): Marker => {
          const selected = hospital.id === selectedRef.current
          const body = document.createElement('span')
          body.className = 'tc-pin-body'
          body.setAttribute('role', 'img')
          body.setAttribute('aria-label', hospital.name)
          body.textContent = '✚'
          const marker = L.marker([hospital.lat + latOffset, hospital.lng + lngOffset], {
            icon: L.divIcon({
              className: `tc-hospital-pin${selected ? ' tc-pin--selected' : ''}`,
              html: body,
              iconSize: [34, 38],
              iconAnchor: [17, 36],
              tooltipAnchor: [17, -20],
            }),
            title: hospital.name,
            riseOnHover: true,
            zIndexOffset: selected ? 1000 : 0,
          })
          const label = document.createElement('span')
          label.textContent = hospital.name
          marker.bindTooltip(label, { permanent: false, direction: 'right', className: 'tc-node-label' })
          marker.on('click', () => selectHospital(hospital.id))
          return marker
        }

        /** 生成聚合图标：仍是医院十字，带数量角标（不是普通数字圆圈） */
        const createClusterPin = (entry: NodeEntry, onClick: () => void): Marker => {
          const body = document.createElement('span')
          body.className = 'tc-cluster-body'
          body.setAttribute('role', 'img')
          body.setAttribute('aria-label', `${entry.members.length} 家机构，点击放大`)
          const plus = document.createElement('i')
          plus.textContent = '✚'
          const count = document.createElement('strong')
          count.textContent = String(entry.members.length)
          body.append(plus, count)
          const marker = L.marker([entry.lat, entry.lng], {
            icon: L.divIcon({
              className: 'tc-cluster-pin',
              html: body,
              iconSize: [40, 44],
              iconAnchor: [20, 40],
              tooltipAnchor: [20, -22],
            }),
            title: `${entry.members.length} 家机构`,
            riseOnHover: true,
          })
          const label = document.createElement('span')
          label.textContent = entry.members.map((item) => item.name).join('、')
          marker.bindTooltip(label, { permanent: false, direction: 'right', className: 'tc-node-label' })
          marker.on('click', onClick)
          return marker
        }

        /**
         * 分级渲染节点：
         * - z < 7：不显示
         * - 7 ≤ z < 10：按屏幕像素网格聚合，点击聚合图标平滑放大
         * - z ≥ 10：展开为单个图钉；同址（坐标四舍五入相同）的机构做扇形展开，避免完全叠压
         */
        const renderNodes = () => {
          const currentMap = mapRef.current
          const nodeLayer = nodeLayerRef.current
          const clusterLayer = clusterLayerRef.current
          if (!currentMap || !nodeLayer || !clusterLayer) return

          nodeLayer.clearLayers()
          clusterLayer.clearLayers()

          const z = currentMap.getZoom()
          if (z < NODE_ZOOM_THRESHOLD) {
            nodeLayer.remove()
            clusterLayer.remove()
            nodesOnRef.current = false
            return
          }
          nodesOnRef.current = true

          const hospitals = propsRef.current.mapHospitals

          if (z >= CLUSTER_MAX_ZOOM) {
            // 同址分组 → 扇形展开（spiderfy）
            const byCoord = new Map<string, MapHospital[]>()
            for (const hospital of hospitals) {
              const key = `${hospital.lat.toFixed(4)},${hospital.lng.toFixed(4)}`
              const list = byCoord.get(key) ?? []
              list.push(hospital)
              byCoord.set(key, list)
            }
            for (const group of byCoord.values()) {
              if (group.length === 1) {
                nodeLayer.addLayer(createPin(group[0]))
                continue
              }
              // 按当前缩放级别用像素计算半径，再换算回经纬度；固定度数会随缩放变化，
              // 导致图钉在某些级别仍重叠或看起来突然跳开。
              const origin = currentMap.project([group[0].lat, group[0].lng], z)
              const radius = Math.max(24, 18 * Math.sqrt(group.length))
              group.forEach((hospital, index) => {
                const angle = (index / group.length) * Math.PI * 2
                const target = currentMap.unproject(
                  origin.add([Math.sin(angle) * radius, Math.cos(angle) * radius]),
                  z,
                )
                nodeLayer.addLayer(
                  createPin(hospital, target.lat - hospital.lat, target.lng - hospital.lng),
                )
              })
            }
            clusterLayer.remove()
            nodeLayer.addTo(currentMap)
            return
          }

          // 屏幕像素网格聚合
          const cells = new Map<string, NodeEntry>()
          for (const hospital of hospitals) {
            const point = currentMap.project([hospital.lat, hospital.lng], z)
            const key = `${Math.floor(point.x / CLUSTER_PIXEL)}:${Math.floor(point.y / CLUSTER_PIXEL)}`
            const entry = cells.get(key)
            if (entry) {
              entry.members.push(hospital)
              entry.lat = (entry.lat * (entry.members.length - 1) + hospital.lat) / entry.members.length
              entry.lng = (entry.lng * (entry.members.length - 1) + hospital.lng) / entry.members.length
            } else {
              cells.set(key, { key, lat: hospital.lat, lng: hospital.lng, members: [hospital] })
            }
          }

          for (const entry of cells.values()) {
            if (entry.members.length === 1) {
              nodeLayer.addLayer(createPin(entry.members[0]))
            } else {
              clusterLayer.addLayer(
                createClusterPin(entry, () => {
                  const target = Math.min(CLUSTER_MAX_ZOOM, currentMap.getZoom() + 2)
                  moveTo(entry.lat, entry.lng, target)
                }),
              )
            }
          }
          nodeLayer.addTo(currentMap)
          clusterLayer.addTo(currentMap)
        }

        const applyZoomStyles = () => {
          const currentMap = mapRef.current
          const geoLayer = geoLayerRef.current
          if (!currentMap || !geoLayer) return
          const z = currentMap.getZoom()
          zoomRef.current = z
          setZoom(z)
          const detailed = z >= NODE_ZOOM_THRESHOLD
          geoLayer.resetStyle()
          geoLayer.eachLayer((layer) => {
            if (detailed) layer.closeTooltip()
            const element = (layer as unknown as { getElement?: () => SVGElement }).getElement?.()
            if (element) element.style.pointerEvents = detailed ? 'none' : 'auto'
          })
          renderNodes()
        }

        // 省界层：密度 choropleth + 悬停概要 + 点击进详情
        const geoLayer = L.geoJSON(geo, {
          style: (feature) => {
            const adcode = String(feature?.properties?.adcode ?? '')
            if (adcode.endsWith('_JD')) {
              return { color: '#8a93a0', weight: 1, dashArray: '4 3', fill: false }
            }
            const count = propsRef.current.provinceStats[adcode]?.reports ?? 0
            const detailed = zoomRef.current >= NODE_ZOOM_THRESHOLD
            return {
              color: '#78a88e',
              weight: 1.1,
              fillColor: densityColor(count),
              fillOpacity: detailed ? 0.06 : count ? 0.72 : 0.92,
            }
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
                `机构：${stat?.hospitals ?? 0} 家（其中具备创伤服务证据 ${stat?.withEvidence ?? 0} 家）`,
              ].join('<br/>'),
              { sticky: true, className: 'tc-province-tip' },
            )
            layer.on('click', () => { if (zoomRef.current < NODE_ZOOM_THRESHOLD) selectProvince(adcode) })
            layer.on('mouseover', () => { if (zoomRef.current >= NODE_ZOOM_THRESHOLD) layer.closeTooltip() })
          },
        }).addTo(map)
        geoLayerRef.current = geoLayer

        // 所有省份都保留常驻名称；标签不参与交互，避免挡住省界点击。
        const provinceLabels = geo.features.flatMap((feature) => {
          const adcode = String(feature.properties?.adcode ?? '')
          if (adcode.endsWith('_JD')) return []
          const labelCenter = feature.properties?.centroid ?? feature.properties?.center
          if (!Array.isArray(labelCenter)) return []
          const province = propsRef.current.provinces.find((item) => item.adcode === adcode)
          const labelText = province?.short_name ?? String(feature.properties?.name ?? '').replace(/省$|市$|自治区$|特别行政区$/, '')
          if (!labelText) return []
          const content = document.createElement('span')
          content.className = 'tc-province-label-text'
          content.textContent = labelText
          content.setAttribute('aria-hidden', 'true')
          const labelWidth = Math.max(30, Array.from(labelText).length * 12 + 6)
          const marker = L.marker([labelCenter[1], labelCenter[0]], {
            interactive: false,
            zIndexOffset: -100,
            icon: L.divIcon({ className: 'tc-province-label', html: content, iconSize: [labelWidth, 24], iconAnchor: [labelWidth / 2, 12] }),
          })
          return [marker]
        })
        L.layerGroup(provinceLabels).addTo(map)

        const interrupt = () => { map?.stop() }
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
      map?.stop()
      map?.remove()
      mapRef.current = null
      geoLayerRef.current = null
      nodeLayerRef.current = null
      clusterLayerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const backToCountry = () => {
    setSelectedHospitalId(null)
    setSelectedProvinceAdcode(null)
    const map = mapRef.current as unknown as { __fitCountry?: (withSidebar: boolean) => void } | null
    if (map?.__fitCountry) map.__fitCountry(sidebarOpen)
    else {
      const leaflet = mapRef.current
      leaflet?.setView([35.5, 105], 4, { animate: false })
    }
  }

  // 统一搜索：省份 / 机构 / 病症（多关键词、支持英文简称）
  const searchResults = useMemo<SearchResult[]>(() => {
    const q = query.trim()
    if (!q) return []
    const results: SearchResult[] = []
    for (const province of propsRef.current.provinces) {
      if (matchesSearch(`${province.name} ${province.short_name}`, q)) {
        results.push({
          key: `province-${province.adcode}`,
          group: '省份',
          label: province.name,
          sub: '省份概要',
          run: () => selectProvince(province.adcode),
        })
      }
      if (results.filter((item) => item.group === '省份').length >= 3) break
    }
    const hospitals: SearchResult[] = []
    for (const hospital of propsRef.current.hospitals) {
      const haystack = hospitalSearchText(hospital, propsRef.current.reports)
      if (matchesSearch(haystack, q)) {
        hospitals.push({
          key: `hospital-${hospital.id}`,
          group: '机构',
          label: hospital.name,
          sub: `${hospital.city && hospital.city !== hospital.province ? `${hospital.province} · ${hospital.city}` : hospital.province} · 线索 ${propsRef.current.reportCounts[hospital.id] ?? 0} 条`,
          run: () => selectHospital(hospital.id),
        })
      }
      if (hospitals.length >= 6) break
    }
    results.push(...hospitals)

    // 医生线索：与侧栏「医生线索」标签、/doctors/ 页共用同一聚合函数，避免口径漂移
    const doctors: SearchResult[] = []
    for (const group of aggregateDoctorLeads(propsRef.current.hospitals, propsRef.current.reports, q)) {
      for (const entry of group.entries) {
        doctors.push({
          key: `doctor-${entry.hospitalId}-${entry.name}`,
          group: '医生',
          label: entry.name,
          sub: `${entry.hospitalName} · ${group.label} · 线索 ${entry.leadCount} 条`,
          run: () => selectHospital(entry.hospitalId),
        })
        if (doctors.length >= 5) break
      }
      if (doctors.length >= 5) break
    }
    results.push(...doctors)

    const disorders: SearchResult[] = []
    for (const disorder of propsRef.current.disorders) {
      if (!disorder.visible) continue
      if (!matchesSearch(`${disorder.name_zh} ${disorder.name_en} ${disorder.id}`, q)) continue
      disorders.push({
        key: `disorder-${disorder.id}`,
        group: '病症',
        label: `${disorder.name_zh}（${disorder.id.toUpperCase()}）`,
        sub: `ICD-11 ${disorder.icd11_code}`,
        run: () => {
          setSeedDisorder(disorder.id)
          setSidebarTab('reports')
          setSidebarOpen(true)
        },
      })
    }
    results.push(...disorders.slice(0, 2))
    return results.slice(0, 10)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const grouped = useMemo(() => {
    const order: SearchGroup[] = ['省份', '机构', '医生', '病症']
    return order
      .map((group) => ({ group, items: searchResults.filter((item) => item.group === group) }))
      .filter((entry) => entry.items.length > 0)
  }, [searchResults])

  const runResult = (result: SearchResult) => {
    result.run()
    setQuery('')
    setActiveResult(-1)
  }

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
          initialDisorder={seedDisorder}
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
    <div className={`tc-mapapp${sidebarOpen ? ' tc-mapapp--open' : ''}${searchResults.length > 0 ? ' tc-mapapp--searching' : ''}`}>
      <div ref={containerRef} className="tc-mapapp-canvas" role="application" aria-label="全国就诊资源与线索地图" />
      {mapError && (
        <div className="tc-mapapp-error" role="alert">
          地图加载失败：{mapError}（其余数据仍可在侧边栏浏览）
        </div>
      )}

      <div className="tc-mapapp-topbar">
        <button
          ref={burgerRef}
          type="button"
          className="tc-mapapp-burger"
          aria-label={sidebarOpen ? '收起侧边栏' : '展开侧边栏'}
          aria-expanded={sidebarOpen}
          aria-controls="tc-map-sidebar"
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
            placeholder="搜索省份 / 机构 / 病症"
            aria-label="搜索省份、机构或病症"
            role="combobox"
            aria-expanded={searchResults.length > 0}
            aria-controls="tc-map-search-results"
            aria-autocomplete="list"
            aria-activedescendant={activeResult >= 0 ? `tc-search-option-${activeResult}` : undefined}
            onChange={(event) => { setQuery(event.target.value); setActiveResult(-1) }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActiveResult((index) => Math.min(searchResults.length - 1, index + 1))
              } else if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActiveResult((index) => Math.max(-1, index - 1))
              } else if (event.key === 'Enter') {
                const target = searchResults[activeResult] ?? searchResults[0]
                if (target) runResult(target)
              } else if (event.key === 'Escape') {
                if (searchResults.length > 0) {
                  event.stopPropagation()
                  setQuery('')
                  setActiveResult(-1)
                }
              }
            }}
          />
          {searchResults.length > 0 && (
            <ul className="tc-mapapp-results" id="tc-map-search-results" role="listbox" aria-label="搜索结果">
              {grouped.map((entry) => (
                <li key={entry.group} role="group" aria-label={entry.group}>
                  <p className="tc-mapapp-results-group">{entry.group}</p>
                  <ul className="tc-plainlist">
                    {entry.items.map((result) => {
                      const index = searchResults.indexOf(result)
                      return (
                        <li key={result.key} role="option" id={`tc-search-option-${index}`} aria-selected={index === activeResult}>
                          <button
                            type="button"
                            className={index === activeResult ? 'tc-mapapp-result tc-mapapp-result--active' : 'tc-mapapp-result'}
                            onMouseEnter={() => setActiveResult(index)}
                            onClick={() => runResult(result)}
                          >
                            <strong>{result.label}</strong>
                            <small>{result.sub}</small>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="tc-badge tc-badge--neutral tc-mapapp-scope">
          {scope === 'country' ? '探索就诊线索' : '点击图钉查看机构'}
        </span>
      </div>

      {sidebarOpen && <div className="tc-mapapp-backdrop" onClick={() => { setSidebarOpen(false); burgerRef.current?.focus() }} />}

      <Sidebar
        id="tc-map-sidebar"
        panelRef={sidebarRef}
        open={sidebarOpen}
        tabs={tabs}
        detail={detailNode}
        totals={props.totals}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        onClose={() => { setSidebarOpen(false); if (!desktopRef.current) burgerRef.current?.focus() }}
      />

      <div className="tc-project-corner">
        <button type="button" className="tc-mapapp-ctl" aria-expanded={aboutOpen} onClick={() => setAboutOpen((v) => !v)}>关于项目</button>
        {aboutOpen && <section className="tc-project-card" aria-label="关于项目">
          <div className="tc-row tc-row--between"><strong>TraumaCompass</strong><button className="tc-linklike" onClick={() => setAboutOpen(false)}>关闭</button></div>
          <p>本项目旨在为CPTSD/BPD人群提供全国就诊地图，帮助更多人治疗心理创伤与障碍</p>
          <p className="tc-meta">仅供信息参考，不提供医疗建议。</p>
          <Link href="/about/">了解我们</Link>
        </section>}
      </div>

      <details className="tc-mapapp-legend">
        <summary>
          图例 · 线索密度
          <span className="tc-ramp tc-ramp--mini" aria-hidden="true" />
        </summary>
        <p>色块表示各省收录线索条数，不代表患病或就诊人数。</p>
        <div className="tc-density-key">
          {[["#b9e6c8", "1–2"], ["#7dd3a4", "3–4"], ["#4dbb83", "5–7"], ["#2f9e68", "8–10"], ["#147a52", "11+"]].map(([color, label]) => (
            <span key={label}><i style={{ background: color }} />{label}</span>
          ))}
        </div>
        <p>白色 ?：暂无收录。十字图钉：医院（叠放时显示数量）。</p>
        <p>图钉位置：{coordinateNote}。</p>
        {!tileKey && <p>示意底图 · 非标准地图</p>}
      </details>

      <div className="tc-mapapp-actions">
        <button type="button" className="tc-mapapp-ctl" onClick={backToCountry} title="回到全国视图" aria-label="回到全国视图">
          <span aria-hidden="true">◎</span>
          <span className="tc-mapapp-ctl-label">回到全国</span>
        </button>
      </div>
    </div>
  )
}
