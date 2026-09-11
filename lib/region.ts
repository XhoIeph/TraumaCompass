/**
 * 省级行政区辅助函数（GB/T 2260 adcode）。
 * 同时被构建脚本与站点使用，保证地图 join 与展示名称一致。
 */

const REGION_BY_PREFIX: Array<{ prefix: string; region: string }> = [
  { prefix: '11', region: '华北' },
  { prefix: '12', region: '华北' },
  { prefix: '13', region: '华北' },
  { prefix: '14', region: '华北' },
  { prefix: '15', region: '华北' },
  { prefix: '21', region: '东北' },
  { prefix: '22', region: '东北' },
  { prefix: '23', region: '东北' },
  { prefix: '31', region: '华东' },
  { prefix: '32', region: '华东' },
  { prefix: '33', region: '华东' },
  { prefix: '34', region: '华东' },
  { prefix: '35', region: '华东' },
  { prefix: '36', region: '华东' },
  { prefix: '37', region: '华东' },
  { prefix: '41', region: '华中' },
  { prefix: '42', region: '华中' },
  { prefix: '43', region: '华中' },
  { prefix: '44', region: '华南' },
  { prefix: '45', region: '华南' },
  { prefix: '46', region: '华南' },
  { prefix: '50', region: '西南' },
  { prefix: '51', region: '西南' },
  { prefix: '52', region: '西南' },
  { prefix: '53', region: '西南' },
  { prefix: '54', region: '西南' },
  { prefix: '61', region: '西北' },
  { prefix: '62', region: '西北' },
  { prefix: '63', region: '西北' },
  { prefix: '64', region: '西北' },
  { prefix: '65', region: '西北' },
  { prefix: '71', region: '港澳台' },
  { prefix: '81', region: '港澳台' },
  { prefix: '82', region: '港澳台' },
]

export type ProvinceRegion =
  | '华北'
  | '东北'
  | '华东'
  | '华中'
  | '华南'
  | '西南'
  | '西北'
  | '港澳台'

export function regionOfAdcode(adcode: string): ProvinceRegion {
  const prefix = adcode.slice(0, 2)
  const hit = REGION_BY_PREFIX.find((entry) => entry.prefix === prefix)
  return (hit?.region ?? '其他') as ProvinceRegion
}

const SHORT_NAME_OVERRIDES: Record<string, string> = {
  内蒙古自治区: '内蒙古',
  广西壮族自治区: '广西',
  西藏自治区: '西藏',
  宁夏回族自治区: '宁夏',
  新疆维吾尔自治区: '新疆',
  香港特别行政区: '香港',
  澳门特别行政区: '澳门',
}

export function shortProvinceName(name: string): string {
  const override = SHORT_NAME_OVERRIDES[name]
  if (override) return override
  return name.replace(/(省|市|自治区|特别行政区)$/u, '')
}

type ProvinceLike = { adcode: string; name: string; short_name: string }

/**
 * 从自由文本（平台 IP 属地 / 作者自述地区 / 医院所在地区）推断省级行政区。
 * 站点与构建脚本共用，避免同一份线索在两侧被归到不同省份。
 */
export function matchProvinceAdcode(
  texts: Array<string | undefined>,
  provinces: ProvinceLike[],
): string | undefined {
  for (const text of texts) {
    if (!text) continue
    const hit = provinces.find(
      (province) => text.includes(province.name) || text.includes(province.short_name),
    )
    if (hit) return hit.adcode
  }
  return undefined
}
