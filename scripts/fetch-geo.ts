/**
 * 下载中国省级行政区底图（DataV GeoAtlas，含 adcode/name/center）。
 * 使用 Node 内置 fetch：本机 Windows schannel 吊销检查会导致 curl 失败，Node 不受影响。
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json'
const TARGET = resolve(process.cwd(), 'public/geo/china-provinces.json')

const response = await fetch(SOURCE)

if (!response.ok) {
  throw new Error(`底图下载失败：HTTP ${response.status} ${response.statusText}`)
}

const geo = (await response.json()) as { features?: unknown[] }
const features = Array.isArray(geo.features) ? geo.features : []

if (features.length < 30) {
  throw new Error(`底图要素数量异常（${features.length}），疑似返回了错误内容，已中止`)
}

mkdirSync(dirname(TARGET), { recursive: true })
writeFileSync(TARGET, JSON.stringify(geo), 'utf8')

console.log(`✓ 底图已写入 ${TARGET}（${features.length} 个要素）`)
console.log('  来源：DataV GeoAtlas，仅供示意，非标准地图；公开宣传前须替换为自然资源部标准地图并标注审图号。')
