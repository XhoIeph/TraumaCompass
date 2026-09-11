/**
 * 由底图生成 data/curated/provinces.json（adcode / name / short_name / region / geojson_name）。
 * 站点地图与医院数据都按 adcode join，这个文件是二者唯一的名称来源。
 */
import { regionOfAdcode, shortProvinceName } from '../lib/region.ts'
import { GEO_FILE, CURATED_FILES, readJson, today, writeJson } from './lib/paths.ts'

type GeoFeature = {
  properties?: { adcode?: number | string; name?: string }
}

const geo = readJson<{ features?: GeoFeature[] }>(GEO_FILE)
const features = Array.isArray(geo.features) ? geo.features : []

const items = features
  .map((feature) => {
    const rawAdcode = feature.properties?.adcode
    const adcode = typeof rawAdcode === 'number' ? String(rawAdcode) : (rawAdcode ?? '')
    const name = feature.properties?.name ?? ''
    return { adcode, name }
  })
  .filter((entry) => /^\d{6}$/.test(entry.adcode) && entry.name.length > 0)
  .map((entry) => ({
    adcode: entry.adcode,
    name: entry.name,
    short_name: shortProvinceName(entry.name),
    region: regionOfAdcode(entry.adcode),
    geojson_name: entry.name,
  }))
  .sort((a, b) => a.adcode.localeCompare(b.adcode))

if (items.length < 30) {
  throw new Error(`省级行政区数量异常（${items.length}），请先运行 npm run geo:fetch`)
}

writeJson(CURATED_FILES.provinces, {
  schema_version: '1.0.0',
  updated_at: today(),
  items,
})

console.log(`✓ 已写入 ${CURATED_FILES.provinces}（${items.length} 个省级行政区）`)
const byRegion = new Map<string, number>()
for (const item of items) {
  byRegion.set(item.region, (byRegion.get(item.region) ?? 0) + 1)
}
console.log(`  大区分布：${[...byRegion].map(([region, count]) => `${region} ${count}`).join('，')}`)
