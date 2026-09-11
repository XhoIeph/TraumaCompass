/**
 * 采集用量统计（**不是配额**）。
 *
 * 用户已明确取消所有自设上限：这里只记录「今天做了多少次调用」用于复盘与风控观察，
 * 永远不会因为数量而拒绝执行。真正需要停下来的信号只有两个：
 *   1) 平台出现登录墙 / 验证码 / 限流页 —— 立即停止；
 *   2) 检索连续多轮不再产出高相关度新内容（饱和）。
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SECRETS_DIR, readJson, today, writeJson } from '../lib/paths.ts'

/** 仅用于统计展示，不再有任何拦截作用 */
export type QuotaKind = 'search' | 'note' | 'comments'

export type QuotaState = {
  date: string
  counts: Record<QuotaKind, number> & { total: number }
}

const QUOTA_FILE = resolve(SECRETS_DIR, 'quota.json')

export function quotaFile(): string {
  return QUOTA_FILE
}

export function emptyQuota(): QuotaState {
  return { date: today(), counts: { search: 0, note: 0, comments: 0, total: 0 } }
}

export function loadQuota(): QuotaState {
  if (!existsSync(QUOTA_FILE)) return emptyQuota()
  const state = readJson<QuotaState>(QUOTA_FILE)
  if (state.date !== today()) return emptyQuota()
  return state
}

export function saveQuota(state: QuotaState): void {
  writeJson(QUOTA_FILE, state)
}

/** 记录一次调用。永远不抛错、不拒绝。 */
export function consumeQuota(kind: QuotaKind, amount = 1): QuotaState {
  const state = loadQuota()
  state.counts[kind] += amount
  state.counts.total += amount
  saveQuota(state)
  return state
}

export function formatQuota(state: QuotaState): string {
  const parts = (['search', 'note', 'comments'] as QuotaKind[]).map(
    (kind) => `${kind} ${state.counts[kind]}`,
  )
  return `${state.date}｜${parts.join('｜')}｜总 ${state.counts.total}`
}

