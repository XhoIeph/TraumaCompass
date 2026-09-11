/**
 * 采集配额的纯逻辑（供 CLI 与调用包装脚本共用）。
 * 配额按自然日重置，落在 .secrets/quota.json。
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { SECRETS_DIR, readJson, today, writeJson } from '../lib/paths.ts'

export const DAILY_CAPS = {
  search: 15,
  note: 30,
  comments: 8,
  total: 60,
} as const

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

export function remainingQuota(state: QuotaState, kind: QuotaKind): number {
  const kindLeft = DAILY_CAPS[kind] - state.counts[kind]
  const totalLeft = DAILY_CAPS.total - state.counts.total
  return Math.max(0, Math.min(kindLeft, totalLeft))
}

/** 检查并记账；配额不足时抛出，调用方不应绕过。 */
export function consumeQuota(kind: QuotaKind, amount = 1): QuotaState {
  const state = loadQuota()
  const left = remainingQuota(state, kind)
  if (amount > left) {
    throw new Error(
      `今日「${kind}」配额不足：请求 ${amount}，剩余 ${left}（上限 ${DAILY_CAPS[kind]}，总上限 ${DAILY_CAPS.total}）。请明天继续，不要绕过配额。`,
    )
  }
  state.counts[kind] += amount
  state.counts.total += amount
  saveQuota(state)
  return state
}

export function formatQuota(state: QuotaState): string {
  const parts = (['search', 'note', 'comments'] as QuotaKind[]).map(
    (kind) => `${kind} ${state.counts[kind]}/${DAILY_CAPS[kind]}`,
  )
  return `${state.date}｜${parts.join('｜')}｜总 ${state.counts.total}/${DAILY_CAPS.total}`
}
