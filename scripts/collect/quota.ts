/**
 * 采集配额守卫：把「每天最多看多少」变成代码约束，而不是靠自觉。
 *
 *   node scripts/collect/quota.ts status
 *   node scripts/collect/quota.ts check note      # 超额时退出码 1
 *   node scripts/collect/quota.ts consume note 3  # 记账，超额时拒绝并退出码 1
 *
 * 配额写进 .secrets/quota.json（按自然日重置）。
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

type QuotaState = {
  date: string
  counts: Record<QuotaKind, number> & { total: number }
}

const QUOTA_FILE = resolve(SECRETS_DIR, 'quota.json')

function emptyState(): QuotaState {
  return { date: today(), counts: { search: 0, note: 0, comments: 0, total: 0 } }
}

export function loadQuota(): QuotaState {
  if (!existsSync(QUOTA_FILE)) return emptyState()
  const state = readJson<QuotaState>(QUOTA_FILE)
  if (state.date !== today()) return emptyState()
  return state
}

function saveQuota(state: QuotaState) {
  writeJson(QUOTA_FILE, state)
}

function remaining(state: QuotaState, kind: QuotaKind): number {
  const kindLeft = DAILY_CAPS[kind] - state.counts[kind]
  const totalLeft = DAILY_CAPS.total - state.counts.total
  return Math.max(0, Math.min(kindLeft, totalLeft))
}

function report(state: QuotaState) {
  console.log(`采集配额（${state.date}）`)
  for (const kind of ['search', 'note', 'comments'] as QuotaKind[]) {
    console.log(
      `  ${kind.padEnd(9)} 已用 ${state.counts[kind]} / ${DAILY_CAPS[kind]}，剩余 ${remaining(state, kind)}`,
    )
  }
  console.log(`  ${'总量'.padEnd(8)} 已用 ${state.counts.total} / ${DAILY_CAPS.total}`)
}

function main() {
  const [command, kindArg, amountArg] = process.argv.slice(2)
  const kind = (kindArg ?? 'note') as QuotaKind

  if (command === 'status' || !command) {
    report(loadQuota())
    return
  }

  if (kind !== 'search' && kind !== 'note' && kind !== 'comments') {
    console.error(`未知配额类型：${kind}（可选 search / note / comments）`)
    process.exit(2)
  }

  const state = loadQuota()

  if (command === 'check') {
    const left = remaining(state, kind)
    report(state)
    if (left <= 0) {
      console.error(`\n✗ 今日「${kind}」配额已用尽，请明天再采集，或明确调高 DAILY_CAPS 并说明理由。`)
      process.exit(1)
    }
    console.log(`\n✓ 今日还可进行 ${left} 次「${kind}」操作`)
    return
  }

  if (command === 'consume') {
    const amount = amountArg ? Number(amountArg) : 1
    if (!Number.isFinite(amount) || amount <= 0) {
      console.error('consume 的数量必须是正数')
      process.exit(2)
    }
    const left = remaining(state, kind)
    if (amount > left) {
      report(state)
      console.error(`\n✗ 本次请求 ${amount} 次「${kind}」超出今日剩余配额 ${left}，已拒绝。`)
      process.exit(1)
    }
    state.counts[kind] += amount
    state.counts.total += amount
    saveQuota(state)
    report(state)
    console.log(`\n✓ 已记账：${kind} +${amount}`)
    return
  }

  console.error(`未知命令：${command}（可选 status / check / consume）`)
  process.exit(2)
}

main()
