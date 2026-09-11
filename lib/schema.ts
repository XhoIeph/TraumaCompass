import { z } from 'zod'

/**
 * 单一数据事实源：schema 既被 Next 站点（类型）使用，也被 scripts/*.ts（校验）使用。
 * Node 24 原生 TS 剥离可直接运行这些 .ts 脚本，因此无需重复维护一份校验逻辑。
 */
export const SCHEMA_VERSION = '1.0.0'

const httpUrl = z.string().refine(
  (value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  },
  { message: '必须是 http(s) 开头的合法 URL' },
)

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD')

export const platformSchema = z.enum([
  'xiaohongshu',
  'zhihu',
  'weibo',
  'douban',
  'tieba',
  'web',
  'other',
])

export const sourceChannelSchema = z.enum(['browser_session', 'public_web', 'manual'])

export const disorderIdSchema = z.enum(['cptsd', 'bpd', 'osdd', 'did', 'ptsd', 'other'])

export const verificationLevelSchema = z.enum(['unverified', 'corroborated', 'official'])

/* ------------------------------------------------------------------ 疾病条目 */

export const disorderSchema = z.object({
  id: disorderIdSchema,
  name_zh: z.string().min(1),
  name_en: z.string().min(1),
  icd11_code: z.string().min(1),
  /** ICD-10 中的对应编码；null 表示 ICD-10 没有对应诊断类目 */
  icd10_equivalent: z.string().nullable(),
  /** 是否属于「ICD-11 可诊断、ICD-10 无对应」 */
  icd11_only: z.boolean(),
  summary: z.string().min(1),
  diagnostic_notes: z.string().min(1),
  /** 首发可见的疾病条目（MVP 仅 CPTSD / BPD） */
  visible: z.boolean(),
  /** 编码是否已在 WHO ICD-11 浏览器逐条核对 */
  code_review_status: z.enum(['verified', 'pending_review']),
  sources: z.array(httpUrl).min(1),
})

/* ------------------------------------------------------------------ 医院 */

export const hospitalSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id 只允许小写字母、数字与连字符'),
  name: z.string().min(1),
  aliases: z.array(z.string()),
  /** GB/T 2260 省级行政区划代码，必须能在 provinces.json 中找到 */
  adcode: z.string().regex(/^\d{6}$/),
  province: z.string().min(1),
  city: z.string().min(1),
  level: z.enum(['三级甲等', '三级乙等', '三级', '二级甲等', '二级', '其他', '未知']),
  category: z.enum(['精神专科', '综合医院心理科', '综合医院精神科', '民营', '其他']),
  departments: z.array(z.string()).min(1),
  /** 创伤相关服务能力：只能依据 official_sources 或线索推断，不得凭印象填写 */
  trauma_service: z.object({
    cptsd_assessment: z.enum(['yes', 'no', 'unknown', 'claimed']),
    cptsd_bpd_diagnosis: z.enum(['yes', 'no', 'unknown', 'claimed']),
    icd11_practice: z.enum(['yes', 'no', 'unknown', 'claimed']),
    evidence: z.array(z.string()),
  }),
  address: z.string().optional(),
  website: httpUrl.optional(),
  phone_public: z.string().optional(),
  /** 地图坐标。真实地理编码优先；暂无时用省级质心＋确定性偏移，并在 coordinates_source 如实标注 */
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable(),
  coordinates_source: z.enum(['geocoded', 'province-centroid', 'manual']).optional(),
  /** 官方来源（医院官网 / 卫健委等）；level=official 的依据 */
  official_sources: z.array(httpUrl),
  last_verified_at: isoDate,
})

/* ------------------------------------------------------------------ 医生 */

export const doctorSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  hospital_id: z.string().min(1),
  department: z.string().min(1),
  title: z.string().min(1),
  credentials: z.array(z.string()),
  profile_urls: z.array(httpUrl),
  specialties: z.array(z.string()),
  official_sources: z.array(httpUrl),
  last_verified_at: isoDate,
  note: z.string().optional(),
})

/* ------------------------------------------------------------------ 就诊线索 */

export const reportSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  platform: platformSchema,
  source_channel: sourceChannelSchema,
  /** 规范化后的可长期访问链接（展示用） */
  source_url: httpUrl,
  /** 原始链接（小红书含会过期的 xsec_token），只写本地 raw，不进公开数据 */
  source_post_id: z.string().optional(),
  /**
   * 不记录任何用户标识：既不留真实昵称，也不留哈希别名。
   * 本站只保留「平台 + 原帖链接 + 时间」，读者可自行去原帖核对。
   */
  published_at: isoDate.optional(),
  published_at_precision: z.enum(['exact', 'day', 'month', 'year', 'derived', 'unknown']),
  /** 作者自述所在地（原文明确写出时才记录；平台 IP 属地一律不采集） */
  self_reported_region: z.string().optional(),
  /** 医院所在地区（由 hospital_id 关联或原文明确写出） */
  hospital_region: z.string().optional(),
  hospital_id: z.string().optional(),
  hospital_name_raw: z.string().optional(),
  department: z.string().optional(),
  doctor_id: z.string().optional(),
  doctor_name_raw: z.string().optional(),
  doctor_title_raw: z.string().optional(),
  disorders: z.array(disorderIdSchema).min(1),
  stage: z.enum(['seeking', 'consulted', 'assessed', 'diagnosed', 'treated', 'unknown']),
  diagnosis_claimed: z
    .object({
      code_raw: z.string().optional(),
      basis: z.enum(['medical_record', 'diagnosis_certificate', 'verbal', 'unknown']),
      confidence: z.enum(['high', 'medium', 'low']),
    })
    .optional(),
  experience: z.number().int().min(1).max(5).nullable(),
  cost_cny: z
    .object({ min: z.number().nonnegative().optional(), max: z.number().nonnegative().optional() })
    .optional(),
  wait_days: z.number().nonnegative().optional(),
  /** 原文片段（≤200 字），必须逐字引用 */
  evidence_quote: z.string().min(1).max(200),
  /** 原文完整文本（评论常超过 200 字；截断会丢语义，故单独保存，≤2000 字） */
  evidence_full_text: z.string().max(2000).optional(),
  /**
   * 摘录的上下文。评论尤其容易「断头」：回复里的「这个 / 它 / 楼上」脱离父评论即无意义。
   * 无法还原上下文时必须显式标 context_incomplete，不允许含糊过去。
   */
  evidence_context: z
    .object({
      note_title: z.string().optional(),
      parent_author: z.string().optional(),
      parent_excerpt: z.string().max(300).optional(),
      is_reply: z.boolean().optional(),
      index_in_capture: z.string().optional(),
      capture_scope: z.string().optional(),
    })
    .optional(),
  /** 上下文无法还原（如父评论未抓到），如实标记以便后续补抓 */
  context_incomplete: z.boolean().optional(),
  evidence_source: z.enum(['note_body', 'comment', 'answer', 'article', 'other']),
  verification: z.object({
    level: verificationLevelSchema,
    checked_by: z.string().optional(),
    checked_at: isoDate.optional(),
    method: z.string().optional(),
    notes: z.string().optional(),
  }),
  extraction: z.object({
    tool: z.string().min(1),
    run_id: z.string().optional(),
    captured_at: isoDate,
  }),
  flags: z.object({
    contains_minor: z.boolean(),
    contains_selfharm_detail: z.boolean(),
    sensitive: z.boolean(),
  }),
  status: z.enum(['published', 'withheld', 'removed']),
})

/* ------------------------------------------------------------------ 省级行政区 */

export const provinceSchema = z.object({
  adcode: z.string().regex(/^\d{6}$/),
  name: z.string().min(1),
  short_name: z.string().min(1),
  region: z.enum(['华北', '东北', '华东', '华中', '华南', '西南', '西北', '港澳台']),
  geojson_name: z.string().min(1),
})

/* ------------------------------------------------------------------ 聚合统计 */

export const provinceStatsItemSchema = z.object({
  adcode: z.string(),
  reports_total: z.number().int().nonnegative(),
  reports_by_disorder: z.object({ cptsd: z.number().int(), bpd: z.number().int() }),
  reports_by_platform: z.record(z.string(), z.number().int()),
  hospitals_total: z.number().int().nonnegative(),
  hospitals_with_service_evidence: z.number().int().nonnegative(),
  doctors_total: z.number().int().nonnegative(),
  verification: z.object({
    official: z.number().int(),
    corroborated: z.number().int(),
    unverified: z.number().int(),
  }),
})

export const provinceStatsSchema = z.object({
  schema_version: z.string(),
  generated_at: z.string(),
  totals: z.object({
    reports: z.number().int(),
    reports_unlocated: z.number().int(),
    hospitals: z.number().int(),
    doctors: z.number().int(),
    provinces_with_reports: z.number().int(),
    provinces_with_hospitals: z.number().int(),
  }),
  items: z.array(provinceStatsItemSchema),
})

/* ------------------------------------------------------------------ 文件包装 */

function collection<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    schema_version: z.string().min(1),
    updated_at: isoDate,
    items: z.array(item),
  })
}

export const disordersFileSchema = collection(disorderSchema)
export const hospitalsFileSchema = collection(hospitalSchema)
export const doctorsFileSchema = collection(doctorSchema)
export const reportsFileSchema = collection(reportSchema)
export const provincesFileSchema = collection(provinceSchema)

/* ------------------------------------------------------------------ 类型导出 */

export type Platform = z.infer<typeof platformSchema>
export type SourceChannel = z.infer<typeof sourceChannelSchema>
export type DisorderId = z.infer<typeof disorderIdSchema>
export type VerificationLevel = z.infer<typeof verificationLevelSchema>
export type Disorder = z.infer<typeof disorderSchema>
export type Hospital = z.infer<typeof hospitalSchema>
export type Doctor = z.infer<typeof doctorSchema>
export type Report = z.infer<typeof reportSchema>
export type Province = z.infer<typeof provinceSchema>
export type ProvinceStatsItem = z.infer<typeof provinceStatsItemSchema>
export type ProvinceStats = z.infer<typeof provinceStatsSchema>
