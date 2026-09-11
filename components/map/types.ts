/** 地图应用内部使用的轻量数据形状（服务端页面组装后传入） */

export type MapProvince = {
  adcode: string
  name: string
  short_name: string
}

export type MapHospital = {
  id: string
  name: string
  adcode: string
  province: string
  city: string
  category: string
  level: string
  lat: number
  lng: number
  coordinateSource?: string
  leads: number
  evidenceCount: number
  doctors: string[]
}

export type MapLead = {
  id: string
  quote: string
  contextNote?: string
  doctor?: string
  stage: string
  platform: string
  publishedAt?: string
  url: string
}

export type MapProvinceStat = {
  reports: number
  hospitals: number
  withEvidence: number
  cptsd: number
  bpd: number
}

export const STAGE_LABELS: Record<string, string> = {
  seeking: '求医中',
  consulted: '已就诊',
  assessed: '已做评估',
  diagnosed: '自称已确诊',
  treated: '已接受治疗',
  unknown: '阶段未知',
}
