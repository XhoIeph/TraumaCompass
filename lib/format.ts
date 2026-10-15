import type { Platform, Report } from './schema'

export const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  zhihu: '知乎',
  weibo: '微博',
  douban: '豆瓣',
  tieba: '贴吧',
  web: '公开网页',
  other: '其他',
}

/**
 * 关于「核验等级」的说明（2026-09-11 按项目所有者决定移除）：
 * 网友自述无法核实 —— 要"核实"就得去调医院诊断记录或人肉评论者，这既不合法也不应该。
 * 因此站点不再显示任何「未核实 / 未经核实」标签，只如实标注**来源**：平台 + 原帖链接 + 时间。
 */

export const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  note_body: '笔记正文',
  comment: '评论区',
  answer: '回答',
  article: '文章',
  other: '原文其他位置',
}

const PRECISION_LABELS: Record<string, string> = {
  exact: '',
  day: '',
  month: '（仅精确到月）',
  year: '（仅精确到年）',
  unknown: '',
}

export function formatPublishedAt(publishedAt?: string, precision?: string): string {
  if (!publishedAt || precision === 'derived' || precision === 'unknown') return ''
  const suffix = precision ? (PRECISION_LABELS[precision] ?? '') : ''
  return `${publishedAt}${suffix}`
}

const SOURCE_POST_TITLES: Record<string, string> = {
  '69f19ded0000000036003cb5': 'cptsd/人格障碍/osdd/did全国就诊线索1.0',
  '69ede05b00000000350314ef': '建设cptsd/人格障碍/osdd/did全国就诊地图',
}

export function formatReportSource(report: Report): string {
  const postId = report.source_post_id?.split('#')[0] ?? report.source_url.match(/\/explore\/([a-f\d]+)/)?.[1]
  const title = (postId && SOURCE_POST_TITLES[postId]) || report.evidence_context?.note_title
  const section = report.evidence_context?.capture_scope?.includes('.webp')
    ? '图片摘录'
    : EVIDENCE_SOURCE_LABELS[report.evidence_source] ?? '原文'
  return title ? `《${title}》${section === '评论区' ? '的评论区' : ` · ${section}`}` : `${PLATFORM_LABELS[report.platform]}${section}`
}

/** 地区展示：只用「医院所在地」或「作者自述所在地」；平台 IP 属地不采集也不展示 */
export function formatRegion(report: {
  hospital_region?: string
  self_reported_region?: string
}): string {
  if (report.hospital_region) return `${report.hospital_region}（医院所在地）`
  if (report.self_reported_region) return `${report.self_reported_region}（作者自述）`
  return '地区未标注'
}

/** 省 + 市 拼接去重：「北京市」+「北京市」→「北京市」 */
export function joinRegion(province: string, city?: string): string {
  if (!city || city === province || province.startsWith(city) || city.startsWith(province)) return province
  return `${province} · ${city}`
}

export function formatCount(value: number): string {
  return value.toLocaleString('zh-CN')
}

export function formatCost(cost?: { min?: number; max?: number }): string {
  if (!cost) return ''
  const { min, max } = cost
  if (min !== undefined && min === max) return `${min} 元`
  if (min !== undefined && max !== undefined) return `${min}–${max} 元`
  if (min !== undefined) return `${min} 元起`
  if (max !== undefined) return `${max} 元以内`
  return ''
}
