/**
 * 采集用量统计 CLI（**无上限，不再拦截任何调用**）。
 *
 *   node scripts/collect/quota.ts status     # 看今天调用了多少次
 *   node scripts/collect/quota.ts reset      # 清零计数（仅统计用）
 */
import type { QuotaKind } from './quota-lib.ts'
import { consumeQuota, emptyQuota, formatQuota, loadQuota, saveQuota } from './quota-lib.ts'

const [command, kindArg, amountArg] = process.argv.slice(2)

if (!command || command === 'status') {
  const state = loadQuota()
  console.log(`今日采集用量（仅统计，无上限）：${formatQuota(state)}`)
  for (const kind of ['search', 'note', 'comments'] as QuotaKind[]) {
    console.log(`  ${kind.padEnd(9)} ${state.counts[kind]} 次`)
  }
  process.exit(0)
}

if (command === 'reset') {
  saveQuota(emptyQuota())
  console.log('✓ 计数已清零')
  process.exit(0)
}

if (command === 'consume') {
  const kind = (kindArg ?? 'note') as QuotaKind
  if (kind !== 'search' && kind !== 'note' && kind !== 'comments') {
    console.error(`未知类型：${kind}（可选 search / note / comments）`)
    process.exit(2)
  }
  const amount = amountArg ? Number(amountArg) : 1
  const state = consumeQuota(kind, Number.isFinite(amount) && amount > 0 ? amount : 1)
  console.log(`✓ 已记录：${kind} +${amount}`)
  console.log(`  ${formatQuota(state)}`)
  process.exit(0)
}

console.error(`未知命令：${command}（可选 status / reset / consume）`)
process.exit(2)
