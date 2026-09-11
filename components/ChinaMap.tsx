'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * 全国省级地图：两层数据（可及资源 / 线索密度）。
 * - echarts 只在浏览器端动态 import，静态导出不受影响。
 * - 首版不打医院点，避免把线索精确到街道造成的误导。
 */

type ProvinceDatum = { adcode: string; name: string; short_name: string }

type Props = {
  provinces: ProvinceDatum[]
  /** adcode → 有官方/可信来源证明可做创伤相关评估或诊断的机构数 */
  resource: Record<string, number>
  /** adcode → 网友自述线索条数 */
  leads: Record<string, number>
  /** adcode → 该省医院总数（用于侧栏展示） */
  hospitalTotals: Record<string, number>
}

type Layer = 'resource' | 'leads'

type ChartLike = {
  setOption: (option: unknown, notMerge?: boolean) => void
  resize: () => void
  dispose: () => void
  on: (event: string, handler: (params: unknown) => void) => void
  off: (event: string) => void
}

const LAYER_META: Record<Layer, { label: string; hint: string; colors: string[] }> = {
  resource: {
    label: '可及资源',
    hint: '按省内可核实的创伤相关评估/诊断机构数着色；灰色表示暂无记录。',
    colors: ['#eef2f8', '#cfe0f7', '#9dc0ee', '#6b9de2', '#3f74cf'],
  },
  leads: {
    label: '线索密度',
    hint: '按省内网友自述线索条数着色；这是自述线索数，不是确诊人数统计。',
    colors: ['#f3f1ee', '#e8dcc9', '#dcc39a', '#cd9f61', '#b8783a'],
  },
}

export function ChinaMap({ provinces, resource, leads, hospitalTotals }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const chartRef = useRef<ChartLike | null>(null)
  const [layer, setLayer] = useState<Layer>('resource')
  const [selected, setSelected] = useState<ProvinceDatum | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const provinceByGeoName = useMemo(() => {
    const map = new Map<string, ProvinceDatum>()
    for (const province of provinces) map.set(province.name, province)
    return map
  }, [provinces])

  const values = useMemo(() => {
    const source = layer === 'resource' ? resource : leads
    const data = provinces.map((province) => ({
      name: province.name,
      value: source[province.adcode] ?? 0,
    }))
    return data
  }, [layer, leads, provinces, resource])

  const maxValue = useMemo(() => {
    const numbers = values.map((item) => Number(item.value) || 0)
    return Math.max(1, ...numbers)
  }, [values])

  // 初始化：加载底图 + 初始化 echarts
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
        chart.on('click', (params: unknown) => {
          const name = (params as { name?: string })?.name
          if (!name) return
          const hit = provinceByGeoName.get(name)
          if (hit) setSelected(hit)
        })
        chartRef.current = chart
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
  }, [provinceByGeoName])

  // 图层切换 / 数据变化时更新配置
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || status !== 'ready') return

    const meta = LAYER_META[layer]
    chart.setOption(
      {
        tooltip: {
          trigger: 'item',
          formatter: (params: unknown) => {
            const name = (params as { name?: string })?.name ?? ''
            const province = provinceByGeoName.get(name)
            if (!province) return name
            const resourceCount = resource[province.adcode] ?? 0
            const leadCount = leads[province.adcode] ?? 0
            const hospitalCount = hospitalTotals[province.adcode] ?? 0
            return [
              `<strong>${name}</strong>`,
              `可及机构（已核实证据）：${resourceCount}`,
              `机构记录总数：${hospitalCount}`,
              `网友自述线索：${leadCount}`,
            ].join('<br/>')
          },
        },
        visualMap: {
          min: 0,
          max: maxValue,
          left: 8,
          bottom: 8,
          text: ['多', '少'],
          calculable: false,
          inRange: { color: meta.colors },
          textStyle: { fontSize: 11, color: '#5a6472' },
        },
        series: [
          {
            type: 'map',
            map: 'traumacompass-china',
            roam: false,
            zoom: 1.16,
            label: { show: false },
            emphasis: {
              label: { show: true, fontSize: 11 },
              itemStyle: { areaColor: '#ffd9a0' },
            },
            itemStyle: { borderColor: '#ffffff', borderWidth: 0.8 },
            data: values,
          },
        ],
      },
      true,
    )
  }, [hospitalTotals, layer, leads, maxValue, provinceByGeoName, resource, status, values])

  const selectedResource = selected ? (resource[selected.adcode] ?? 0) : 0
  const selectedLeads = selected ? (leads[selected.adcode] ?? 0) : 0
  const selectedHospitals = selected ? (hospitalTotals[selected.adcode] ?? 0) : 0

  return (
    <section aria-label="全国就诊资源与线索地图">
      <div className="tc-row tc-row--between" style={{ marginBottom: 'var(--tc-space-3)' }}>
        <div className="tc-row" role="group" aria-label="地图图层">
          {(Object.keys(LAYER_META) as Layer[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`tc-button${layer === key ? ' tc-button--active' : ''}`}
              aria-pressed={layer === key}
              onClick={() => setLayer(key)}
            >
              {LAYER_META[key].label}
            </button>
          ))}
        </div>
        <span className="tc-small tc-muted">点击省份查看该省记录</span>
      </div>

      <p className="tc-small tc-muted" style={{ marginTop: 0 }}>
        {LAYER_META[layer].hint}
      </p>

      <div className="tc-map-layout">
        <div>
          <div ref={containerRef} className="tc-map-canvas" role="img" aria-label={`全国${LAYER_META[layer].label}分布图`} />
          <div className="tc-legend">
            {LAYER_META[layer].colors.map((color, index) => (
              <span key={color}>
                <span className="tc-swatch" style={{ background: color }} />
                {index === 0 ? '少/无' : index === LAYER_META[layer].colors.length - 1 ? '多' : ''}
              </span>
            ))}
          </div>
          {status === 'loading' && <p className="tc-small tc-muted">地图加载中……</p>}
          {status === 'error' && (
            <p className="tc-small" style={{ color: 'var(--tc-danger)' }}>
              地图加载失败：{errorMessage}（其余数据仍可正常浏览）
            </p>
          )}
        </div>

        <aside className="tc-card tc-card--tight" aria-live="polite">
          {selected ? (
            <div className="tc-stack">
              <h2 style={{ marginBottom: 0 }}>{selected.name}</h2>
              <p className="tc-small tc-muted" style={{ margin: 0 }}>
                行政区划代码 {selected.adcode} · {selected.short_name}
              </p>
              <dl className="tc-stack" style={{ margin: 0 }}>
                <div>
                  <dt className="tc-stat-label">可及机构（有已核实证据）</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{selectedResource}</dd>
                </div>
                <div>
                  <dt className="tc-stat-label">机构记录总数</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{selectedHospitals}</dd>
                </div>
                <div>
                  <dt className="tc-stat-label">网友自述线索</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{selectedLeads}</dd>
                </div>
              </dl>
              <div className="tc-row">
                <Link className="tc-button" href={`/reports/?province=${selected.adcode}`}>
                  看该省线索
                </Link>
                <Link className="tc-button" href={`/hospitals/?province=${selected.adcode}`}>
                  看该省医院
                </Link>
              </div>
              {selectedLeads === 0 && selectedHospitals === 0 && (
                <p className="tc-small tc-faint" style={{ margin: 0 }}>
                  暂无记录，不代表当地没有相关资源 —— 只是我们还没收集到可追溯的来源。
                </p>
              )}
            </div>
          ) : (
            <div className="tc-stack">
              <h2 style={{ marginBottom: 0 }}>怎么读这张图</h2>
              <p className="tc-small tc-muted" style={{ margin: 0 }}>
                「可及资源」只统计有官方来源或明确证据支撑的机构；「线索密度」统计的是网友自述条数。
                两者都<strong>不能</strong>当作某地确诊人数或医疗水平的排名。
              </p>
              <p className="tc-small tc-faint" style={{ margin: 0 }}>
                点击任意省份查看详情。
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
