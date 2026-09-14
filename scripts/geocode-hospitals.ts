/**
 * 用高德 Web 服务 POI 检索为医院匹配真实位置。
 *
 * 用法：
 *   npm run geo:geocode                           # 只处理仍为省级示意的机构并写回（日常增量用这个）
 *   node scripts/geocode-hospitals.ts             # dry-run：全部机构，只出报告
 *   node scripts/geocode-hospitals.ts --write     # 全部机构并写回
 *   node scripts/geocode-hospitals.ts --apply <报告路径> --write   # 按已有报告写回，不调 API
 *
 * 主院区判定规则（依次尝试，命中即停）：
 *   0. record-address：候选地址与记录 address 首个院区段（「；」前）的最长公共子串 ≥5 字；
 *   1. base-name：候选名称无「院区/分院」标记（即主体名称），取最高分；
 *   2. main-marker：候选名称含「总院/主院区/院本部」；
 *   3. best-score：最高分候选（非楼栋优先，分数下限 25）。
 * 不再有 ambiguous 状态：只要城市匹配且候选存在，就落点到最合理的主院区；
 * 候选清单完整保留在报告中（data/runs/*-amap-geocode.json），改错可人工修正坐标或 address 后重跑。
 *
 * 其他约定：
 * - key 从 .env.local 的 AMAP_WEB_SERVICE_KEY 读取（Web 服务类型，不进前端、不进仓库）。
 * - 高德返回 GCJ-02；站点底图为天地图（CGCS2000≈WGS84），入库前转换为 WGS84，内置偏移断言防呆。
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'

const APPLY_REPORT = process.argv.includes('--apply') ? process.argv[process.argv.indexOf('--apply') + 1] : null
const WRITE = process.argv.includes('--write')
const MISSING_ONLY = process.argv.includes('--missing')
const HOSPITALS_PATH = 'data/curated/hospitals.json'
const RUNS_DIR = 'data/runs'

function loadEnvKey(): string {
  if (!existsSync('.env.local')) throw new Error('.env.local 不存在')
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^AMAP_WEB_SERVICE_KEY=(.+)\s*$/)
    if (match) return match[1].trim()
  }
  throw new Error('.env.local 缺少 AMAP_WEB_SERVICE_KEY')
}

const KEY = loadEnvKey()
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type Poi = {
  id: string
  name: string
  type: string
  address?: string
  location: string // "lng,lat" GCJ-02
  pname?: string
  cityname?: string
}

async function searchPoi(keywords: string, city: string, types?: string): Promise<Poi[]> {
  const params = new URLSearchParams({ key: KEY, keywords, city, offset: '20', page: '1' })
  if (types) params.set('types', types)
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(`https://restapi.amap.com/v3/place/text?${params}`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const body = (await response.json()) as { status: string; info: string; pois?: Poi[] }
    if (body.status === '1') return body.pois ?? []
    if (/QPS|LIMIT/i.test(body.info)) {
      await sleep(1200 * attempt)
      continue
    }
    return []
  }
  return []
}

/** GCJ-02 → WGS84（标准近似逆变换；断言偏移 >0.02° 即抛错防呆） */
const GCJ_A = 6378245
const GCJ_EE = 0.00669342162296594323

function transformLat(x: number, y: number): number {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2) / 3
  ret += ((160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y * Math.PI) / 30)) * 2) / 3
  return ret
}

function transformLng(x: number, y: number): number {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2) / 3
  ret += ((20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2) / 3
  ret += ((150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2) / 3
  return ret
}

function gcjDelta(lng: number, lat: number): [number, number] {
  let dLat = transformLat(lng - 105, lat - 35)
  let dLng = transformLng(lng - 105, lat - 35)
  const radLat = (lat / 180) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - GCJ_EE * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI)
  dLng = (dLng * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return [dLng, dLat]
}

function gcj02ToWgs84(lng: number, lat: number): [number, number] {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat]
  let wgsLng = lng
  let wgsLat = lat
  for (let i = 0; i < 3; i++) {
    const [dLng, dLat] = gcjDelta(wgsLng, wgsLat)
    wgsLng = lng - dLng
    wgsLat = lat - dLat
  }
  const offset = Math.max(Math.abs(wgsLng - lng), Math.abs(wgsLat - lat))
  if (!Number.isFinite(offset) || offset > 0.02) {
    throw new Error(`GCJ->WGS 转换结果异常：gcj=(${lng},${lat}) wgs=(${wgsLng},${wgsLat})`)
  }
  return [Number(wgsLng.toFixed(6)), Number(wgsLat.toFixed(6))]
}

const clean = (text: string) => text.replace(/[\s（）()·\-–—]/g, '').toLowerCase()

function nameScore(poiName: string, hospitalName: string, aliases: string[]): number {
  const a = clean(poiName)
  const target = clean(hospitalName)
  if (a === target) return 100
  for (const alias of aliases) if (a === clean(alias)) return 96
  if (a.includes(target) || target.includes(a)) return 78
  for (const alias of aliases) if (a.includes(clean(alias)) || clean(alias).includes(a)) return 66
  let common = 0
  while (common < Math.min(a.length, target.length) && a[common] === target[common]) common++
  return Math.min(50, common * 6)
}

function cityHitOk(poi: Poi, hospital: Hospital): boolean {
  return [poi.cityname, poi.pname].some(
    (part) =>
      part &&
      (hospital.city.includes(part) || part.includes(hospital.city.replace(/市$/, '')) || hospital.province.includes(part)),
  )
}

function scorePoi(poi: Poi, hospital: Hospital): number {
  let score = nameScore(poi.name, hospital.name, hospital.aliases)
  score += cityHitOk(poi, hospital) ? 12 : -30
  if (/^090[123]/.test(String(poi.type ?? ''))) score += 8
  else if (!String(poi.type ?? '').startsWith('09')) score -= 15
  return score
}

function campusMarker(name: string): string | null {
  const match = name.match(/([\u4e00-\u9fa5A-Za-z0-9]{1,4})(院区|分院)/)
  return match ? match[1] : null
}

/** 最长公共子串长度（已 clean 的短字符串，O(nm) 足够） */
function lcs(a: string, b: string): number {
  const x = clean(a)
  const y = clean(b)
  let best = 0
  let prev = new Array(y.length + 1).fill(0)
  for (let i = 1; i <= x.length; i++) {
    const cur = new Array(y.length + 1).fill(0)
    for (let j = 1; j <= y.length; j++) {
      cur[j] = x[i - 1] === y[j - 1] ? prev[j - 1] + 1 : 0
      if (cur[j] > best) best = cur[j]
    }
    prev = cur
  }
  return best
}

type Hospital = {
  id: string
  name: string
  aliases: string[]
  province: string
  city: string
  coordinates: { lat: number; lng: number } | null
  coordinates_source?: string
  address?: string
}

type ChosenPoi = {
  poi: string
  poiId: string
  address: string
  gcj02: [number, number]
  wgs84: [number, number]
  score: number
  rule: 'record-address' | 'base-name' | 'main-campus-marker' | 'best-score'
}

type ReportEntry = {
  id: string
  name: string
  city: string
  status: 'geocoded' | 'not_found'
  chosen?: ChosenPoi
  candidates: Array<{ name: string; score: number; address: string; city: string; location: string }>
}

type ScoredPoi = { poi: Poi; score: number }

/** 主院区判定：依次尝试四条规则（见文件头注释），全部失败返回 null */
function resolveMainCampus(hospital: Hospital, scored: ScoredPoi[]): ChosenPoi | null {
  const viable = scored.filter(({ poi }) => cityHitOk(poi, hospital))
  if (!viable.length) return null

  const make = (entry: ScoredPoi, rule: ChosenPoi['rule']): ChosenPoi => {
    const [gcjLng, gcjLat] = entry.poi.location.split(',').map(Number)
    const [wgsLng, wgsLat] = gcj02ToWgs84(gcjLng, gcjLat)
    return {
      poi: entry.poi.name,
      poiId: entry.poi.id,
      address: entry.poi.address ?? '',
      gcj02: [gcjLng, gcjLat],
      wgs84: [wgsLng, wgsLat],
      score: entry.score,
      rule,
    }
  }

  // 0. 记录 address 的首个院区段与候选地址匹配
  if (hospital.address) {
    const firstCampus = hospital.address.split('；')[0]
    let best: ScoredPoi | undefined
    let bestLen = 0
    for (const entry of viable) {
      const len = lcs(entry.poi.address ?? '', firstCampus)
      if (len > bestLen) {
        bestLen = len
        best = entry
      }
    }
    if (best && bestLen >= 5) return make(best, 'record-address')
  }

  const isBuilding = (name: string) => /(门诊|急诊|住院|体检|检验|急救|发热|药房|输液|接种|犬伤|健康服务|[^院]部)$/.test(name) || /(门诊|急诊|住院|体检|检验|急救|发热|药房|输液|接种|犬伤)/.test(name)

  // 1. 总院 / 主院区 / 院本部（优先于主体名称：防止「合作医院」等附属实体抢主院区）
  const mainMarker = viable
    .filter(({ poi }) => /(总院|主院区|院本部)/.test(poi.name))
    .sort((a, b) => b.score - a.score)[0]
  if (mainMarker) return make(mainMarker, 'main-campus-marker')

  // 2. 无院区标记且非楼栋（门诊/检验/体检等）的主体名称 POI
  const baseName = viable
    .filter(({ poi }) => campusMarker(poi.name) === null && !isBuilding(poi.name))
    .sort((a, b) => b.score - a.score)[0]
  if (baseName && baseName.score >= 70) return make(baseName, 'base-name')

  // 3. 最高分兜底：优先非楼栋候选，分数下限 25，避免钉到明显无关的候选
  const nonBuilding = viable.filter(({ poi }) => !isBuilding(poi.name))
  const building = viable.filter(({ poi }) => isBuilding(poi.name))
  // 非楼栋池整体低于下限时，回退到楼栋池（楼栋也在院内，优于省级示意）
  const fallback = nonBuilding.find(({ score }) => score >= 25) ?? building.find(({ score }) => score >= 25)
  if (!fallback) return null
  return make(fallback, 'best-score')
}

async function geocodeHospital(hospital: Hospital): Promise<ReportEntry> {
  const base: ReportEntry = { id: hospital.id, name: hospital.name, city: hospital.city, status: 'not_found', candidates: [] }
  const queries: Array<[string, string?]> = [
    [hospital.name, '090000'],
    [hospital.name],
    ...hospital.aliases.slice(0, 2).map((alias) => [alias] as [string]),
    [hospital.name.replace(/（[^）]*）/g, ''), '090000'],
    [hospital.name.replace(/人民医院$/, '医院'), '090000'],
  ]
  let pois: Poi[] = []
  for (const [keywords, types] of queries) {
    pois = await searchPoi(keywords, hospital.city, types)
    if (pois.length) break
    await sleep(320)
  }
  if (!pois.length) return base

  const scored = pois.map((poi) => ({ poi, score: scorePoi(poi, hospital) })).sort((a, b) => b.score - a.score)
  base.candidates = scored.slice(0, 3).map(({ poi, score }) => ({
    name: poi.name,
    score,
    address: poi.address ?? '',
    city: [poi.pname, poi.cityname].filter(Boolean).join(' '),
    location: poi.location,
  }))

  const chosen = resolveMainCampus(hospital, scored)
  if (chosen) {
    base.status = 'geocoded'
    base.chosen = chosen
  }
  return base
}

async function main() {
  let report: ReportEntry[]
  if (APPLY_REPORT) {
    report = (JSON.parse(readFileSync(APPLY_REPORT, 'utf8')) as { results: ReportEntry[] }).results
    console.log(`从报告应用：${APPLY_REPORT}`)
  } else {
    const current = JSON.parse(readFileSync(HOSPITALS_PATH, 'utf8')) as { items: Hospital[] }
    const targets = MISSING_ONLY ? current.items.filter((h) => h.coordinates_source !== 'geocoded') : current.items
    const processed = new Map<string, ReportEntry>()
    for (const hospital of targets) {
      if (!hospital.coordinates) {
        processed.set(hospital.id, { id: hospital.id, name: hospital.name, city: hospital.city, status: 'not_found', candidates: [] })
        continue
      }
      const entry = await geocodeHospital(hospital)
      processed.set(hospital.id, entry)
      console.log(`${entry.status.padEnd(9)} ${hospital.id} ${hospital.name}${entry.chosen ? ` [${entry.chosen.rule}] -> ${entry.chosen.poi} @ ${entry.chosen.address}` : ''}`)
      await sleep(340)
    }
    // 报告始终覆盖全部机构：--missing 时保留其余条目的旧结果
    const previous = existsSync(`${RUNS_DIR}/2026-09-12-amap-geocode.json`)
      ? (JSON.parse(readFileSync(`${RUNS_DIR}/2026-09-12-amap-geocode.json`, 'utf8')) as { results: ReportEntry[] }).results
      : []
    report = current.items.map((h) => processed.get(h.id) ?? previous.find((r) => r.id === h.id) ?? {
      id: h.id, name: h.name, city: h.city, status: 'not_found' as const, candidates: [],
    })
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const reportPath = `${RUNS_DIR}/${stamp}-amap-geocode.json`
  writeFileSync(reportPath, JSON.stringify({ schema_version: '1.0.0', generated_at: new Date().toISOString(), source: 'amap place/text v3, gcj02->wgs84', results: report }, null, 2))
  const summary = {
    geocoded: report.filter((r) => r.status === 'geocoded').length,
    not_found: report.filter((r) => r.status === 'not_found').length,
  }
  console.log(`\n${JSON.stringify(summary)} 报告: ${reportPath}`)

  if (!WRITE && !APPLY_REPORT) {
    console.log('dry-run：未修改 hospitals.json')
    return
  }
  const chosenList = report.filter((r) => r.chosen)
  if (!chosenList.length) {
    console.log('没有可写回的匹配，未修改 hospitals.json')
    return
  }
  if (!existsSync(`tmp/hospitals.pre-geocode-${stamp}.json`)) {
    copyFileSync(HOSPITALS_PATH, `tmp/hospitals.pre-geocode-${stamp}.json`)
  }
  const data = JSON.parse(readFileSync(HOSPITALS_PATH, 'utf8')) as { items: Hospital[]; updated_at: string }
  const chosen = new Map(chosenList.map((r) => [r.id, r.chosen!]))
  let applied = 0
  for (const hospital of data.items) {
    const match = chosen.get(hospital.id)
    if (!match) continue
    hospital.coordinates = { lat: match.wgs84[1], lng: match.wgs84[0] }
    hospital.coordinates_source = 'geocoded'
    if (!hospital.address && match.address) hospital.address = match.address
    applied++
  }
  data.updated_at = new Date().toISOString().slice(0, 10)
  writeFileSync(HOSPITALS_PATH, JSON.stringify(data, null, 2) + '\n')
  console.log(`已写回 ${applied} 家医院的坐标（备份: tmp/hospitals.pre-geocode-${stamp}.json）`)
}

main()
