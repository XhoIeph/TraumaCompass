/**
 * 配额守卫 CLI。
 *
 *   node scripts/collect/quota.ts status
 *   node scripts/collect/quota.ts check note      # 超额时退出码 1
 *   node scripts/collect/quota.ts consume note 3  # 记账，超额时拒绝并退出码 1
 */
import {
  DAILY_CAPS,
  type QuotaKind,
  consumeQuota,
  formatQuota,
  loadQuota,
  remainingQuota,
} from './quota-lib.ts'

function report() {
  const state = loadQuota()
  console.log(`采集配额（${state.date}）`)
  for (const kind of ['search', 'note', 'comments'] as QuotaKind[]) {
    console.log(
      `  ${kind.padEnd(9)} 已用 ${state.counts[kind]} / ${DAILY_CAPS[kind]}，剩余 ${remainingQuota(state, kind)}`,
    )
  }
  console.log(`  ${'总量'.padEnd(8)} 已用 ${state.counts.total} / ${DAILY_CAPS.total}`)
  return state
}

const [command, kindArg, amountArg] = process.argv.slice(2)
const kind = (kindArg ?? 'note') as QuotaKind

if (!command || command === 'status') {
  report()
  process.exit(0)
}

if (kind !== 'search' && kind !== 'note' && kind !== 'comments') {
  console.error(`未知配额类型：${kind}（可选 search / note / comments）`)
  process.exit(2)
}

if (command === 'check') {
  const state = report()
  const left = remainingQuota(state, kind)
  if (left <= 0) {
    console.error(`\n✗ 今日「${kind}」配额已用尽，请明天再采集。`)
    process.exit(1)
  }
  console.log(`\n✓ 今日还可进行 ${left} 次「${kind}」操作`)
  process.exit(0)
}

if (command === 'consume') {
  const amount = amountArg ? Number(amountArg) : 1
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('consume 的数量必须是正数')
    process.exit(2)
  }
  try {
    const state = consumeQuota(kind, amount)
    console.log(`✓ 已记账：${kind} +${amount}`)
    console.log(`  ${formatQuota(state)}`)
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
  process.exit(0)
}

console.error(`未知命令：${command}（可选 status / check / consume）`)
process.exit(2)
