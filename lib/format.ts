import type { Platform, VerificationLevel } from './schema'

export const PLATFORM_LABELS: Record<Platform, string> = {
  xiaohongshu: '小红书',
  zhihu: '知乎',
  weibo: '微博',
  douban: '豆瓣',
  tieba: '贴吧',
  web: '公开网页',
  other: '其他',
}

export const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  unverified: '未核实',
  corroborated: '多源印证',
  official: '官方来源',
}

export const VERIFICATION_HINTS: Record<VerificationLevel, string> = {
  official: '有医院官网 / 卫健委等官方来源支撑',
  corroborated: '两个及以上独立线索互相印证，但无官方来源',
  unverified: '单条网友自述，未经核实，仅供参考',
}

export const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  note_body: '笔记正文',
  comment: '评论',
  answer: '回答',
  article: '文章',
  other: '其他',
}

const PRECISION_LABELS: Record<string, string> = {
  exact: '',
  day: '',
  month: '（仅精确到月）',
  year: '（仅精确到年）',
  derived: '（由笔记 ID 推导，可能有偏差）',
  unknown: '（原文未标明时间）',
}

export function formatPublishedAt(publishedAt?: string, precision?: string): string {
  if (!publishedAt) return '时间未知'
  const suffix = precision ? (PRECISION_LABELS[precision] ?? '') : ''
  return `${publishedAt}${suffix}`
}

export function formatRegion(report: {
  hospital_region?: string
  self_reported_region?: string
  ip_location?: string
}): string {
  if (report.hospital_region) return `${report.hospital_region}（医院所在地）`
  if (report.self_reported_region) return `${report.self_reported_region}（作者自述）`
  if (report.ip_location) return `${report.ip_location}（平台显示 IP 属地，不等于居住地）`
  return '地区未知'
}

export function formatCount(value: number): string {
  return value.toLocaleString('zh-CN')
}

export function formatCost(cost?: { min?: number; max?: number }): string {
  if (!cost) return ''
  const { min, max } = cost
  if (min !== undefined && max !== undefined) return `${min}–${max} 元`
  if (min !== undefined) return `${min} 元起`
  if (max !== undefined) return `${max} 元以内`
  return ''
}
