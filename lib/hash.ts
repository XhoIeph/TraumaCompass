/**
 * 发言者匿名化：只产出哈希别名，绝不把平台昵称或 uid 写入公开数据。
 * 原始 uid / 昵称只能出现在 data/raw/（已在 .gitignore 中）。
 */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PREFIX: Record<string, string> = {
  xiaohongshu: 'xhs',
  zhihu: 'zh',
  weibo: 'wb',
  douban: 'db',
  tieba: 'tb',
  web: 'web',
  other: 'u',
}

export function aliasFor(platform: string, uid: string, salt: string): string {
  const digest = createHash('sha256').update(`${salt}:${platform}:${uid}`).digest('hex')
  return `${PREFIX[platform] ?? 'u'}-${digest.slice(0, 8)}`
}

export function recordIdFor(platform: string, postId: string): string {
  const digest = createHash('sha1').update(`${platform}:${postId}`).digest('hex')
  return `${PREFIX[platform] ?? 'u'}-${digest.slice(0, 10)}`
}

/** 读取（必要时生成）.secrets/salt.txt —— 不要把这个文件提交或分享出去 */
export function loadSalt(secretsDir: string): string {
  mkdirSync(secretsDir, { recursive: true })
  const saltPath = resolve(secretsDir, 'salt.txt')
  if (existsSync(saltPath)) return readFileSync(saltPath, 'utf8').trim()
  const salt = randomBytes(32).toString('hex')
  writeFileSync(saltPath, `${salt}\n`, { encoding: 'utf8', mode: 0o600 })
  return salt
}
