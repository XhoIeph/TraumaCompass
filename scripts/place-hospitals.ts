/**
 * 为机构生成地图坐标。
 *
 * 当前策略（无外部依赖）：
 * - 若已有 `coordinates_source: 'geocoded' | 'manual'` 的坐标，保持不动；
 * - 否则用**省级质心**（取自底图 GeoJSON 的 centroid / center）作为基准，
 *   同省多家机构按确定性螺旋偏移展开，避免节点完全重叠；
 * - 一律写入 `coordinates_source: 'province-centroid'`，站点会如实标注节点为省级近似位置。
 *
 * 拿到地图服务 key（高德/百度/腾讯）后可换成真实地理编码：
 *   node scripts/geocode-hospitals.ts --provider amap --key <KEY>
 * 该脚本会把 coordinates_source 升级为 'geocoded'。
 *
 *   node scripts/place-hospitals.ts [--dry-run]
 */
import { resolve } from 'node:path'
import type { Hospital, Province } from '../lib/schema.ts'
import { CURATED_FILES, GEO_FILE, readJson, today, writeJson } from './lib/paths.ts'

const dryRun = process.argv.includes('--dry-run')

type GeoFeature = { properties?: { adcode?: number | string; centroid?: number[]; center?: number[] } }

const geo = readJson<{ features?: GeoFeature[] }>(GEO_FILE)
const provinces = readJson<{ items: Province[] }>(CURATED_FILES.provinces).items
const hospitalsFile = readJson<{ schema_version: string; updated_at: string; items: Hospital[] }>(
  CURATED_FILES.hospitals,
)

/** adcode → 省级中心点（centroid 更贴近几何中心，缺失时退回 center） */
const anchors = new Map<string, [number, number]>()
for (const feature of geo.features ?? []) {
  const raw = feature.properties?.adcode
  const adcode = typeof raw === 'number' ? String(raw) : (raw ?? '')
  const point = feature.properties?.centroid ?? feature.properties?.center
  if (/^\d{6}$/.test(adcode) && Array.isArray(point) && point.length === 2) {
    anchors.set(adcode, [Number(point[0]), Number(point[1])])
  }
}

let placed = 0
let kept = 0
const perProvince = new Map<string, number>()

for (const hospital of hospitalsFile.items) {
  if (hospital.coordinates && hospital.coordinates_source && hospital.coordinates_source !== 'province-centroid') {
    kept += 1
    continue
  }

  const anchor = anchors.get(hospital.adcode)
  if (!anchor) {
    console.log(`⚠ ${hospital.id}（${hospital.name}）找不到 ${hospital.adcode} 的省级中心点，跳过`)
    continue
  }

  const index = perProvince.get(hospital.adcode) ?? 0
  perProvince.set(hospital.adcode, index + 1)

  // 确定性螺旋偏移：同省节点按环形展开，半径随序号增大（约 0.12° ≈ 13km 一圈）
  const ring = Math.floor(index / 6)
  const slot = index % 6
  const radius = 0.12 + ring * 0.1
  const angle = (slot / 6) * Math.PI * 2 + ring * 0.6
  const lng = anchor[0] + Math.cos(angle) * radius * 1.25
  const lat = anchor[1] + Math.sin(angle) * radius

  hospital.coordinates = { lat: Number(lat.toFixed(5)), lng: Number(lng.toFixed(5)) }
  hospital.coordinates_source = 'province-centroid'
  placed += 1
}

const provinceName = (adcode: string) => provinces.find((p) => p.adcode === adcode)?.short_name ?? adcode

console.log(`已定位：${placed} 家（省级质心偏移）；保留原有精确坐标：${kept} 家`)
console.log(`涉及省级行政区：${perProvince.size} 个`)
const sample = hospitalsFile.items.filter((h) => h.coordinates_source === 'province-centroid').slice(0, 5)
for (const hospital of sample) {
  console.log(
    `  ${hospital.name}（${provinceName(hospital.adcode)}）→ ${hospital.coordinates?.lat}, ${hospital.coordinates?.lng}`,
  )
}

if (dryRun) {
  console.log('\n（--dry-run，未写入）')
  process.exit(0)
}

hospitalsFile.updated_at = today()
writeJson(CURATED_FILES.hospitals, hospitalsFile)
console.log('\n✓ 已写回 hospitals.json')
console.log(`  注意：这些是省级近似位置，站点会标注坐标来源；真实门址需地图服务 key 做地理编码。`)
