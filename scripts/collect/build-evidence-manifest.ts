/**
 * 生成 data/evidence/manifest.json：为归档的每张图计算 SHA-256，
 * 并与 descriptions.json（人工转写）合并，附上来源帖信息。
 *
 *   node scripts/collect/build-evidence-manifest.ts
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { writeJson } from '../lib/paths.ts'

const EVIDENCE_DIR = resolve(process.cwd(), 'data/evidence')

/** 帖 id → 公开来源链接（含签名 token，便于人工复核；token 会过期，故同时保留规范链接） */
const POST_SOURCES: Record<string, { canonical: string; captured: string }> = {
  '69ede05b00000000350314ef': {
    canonical: 'https://www.xiaohongshu.com/explore/69ede05b00000000350314ef',
    captured:
      'https://www.xiaohongshu.com/discovery/item/69ede05b00000000350314ef?xsec_token=ABgpqyFJ2a565OckDksqc3jMOI930asFFi0aU1sjejzLU=&xsec_source=pc_share',
  },
  '69f19ded0000000036003cb5': {
    canonical: 'https://www.xiaohongshu.com/explore/69f19ded0000000036003cb5',
    captured:
      'https://www.xiaohongshu.com/discovery/item/69f19ded0000000036003cb5?xsec_token=ABN9BC3nECPaOp9LpBwiWvNDnVywAPi4YIKZ2RzPQT4U4=&xsec_source=pc_share',
  },
}

type Description = { contains: string; transcription: string }

const descriptions = JSON.parse(
  readFileSync(join(EVIDENCE_DIR, 'descriptions.json'), 'utf8'),
) as Record<string, Description>

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walk(full, out)
    else if (/\.(webp|jpg|jpeg|png|gif)$/i.test(entry)) out.push(full)
  }
  return out
}

const files = walk(EVIDENCE_DIR).sort()
const items = files.map((file) => {
  const rel = relative(EVIDENCE_DIR, file).replace(/\\/g, '/')
  const parts = rel.split('/')
  const postId = parts[1] ?? ''
  const bytes = readFileSync(file)
  const description = descriptions[rel]
  return {
    file: rel,
    platform: parts[0] ?? 'unknown',
    source_post_id: postId,
    source_post_url: POST_SOURCES[postId]?.canonical ?? '',
    source_post_url_captured: POST_SOURCES[postId]?.captured ?? '',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    contains: description?.contains ?? '(未标注)',
    transcription: description?.transcription ?? '',
  }
})

const missing = items.filter((item) => !item.transcription).map((item) => item.file)

writeJson(join(EVIDENCE_DIR, 'manifest.json'), {
  schema_version: '1.0.0',
  generated_at: new Date().toISOString(),
  note: '图片版权属原作者；转写仅供参考，与图片不一致时以图片为准。',
  count: items.length,
  items,
})

console.log(`✓ 已写入 data/evidence/manifest.json（${items.length} 个文件）`)
if (missing.length > 0) {
  console.log(`⚠ ${missing.length} 个文件缺少转写：`)
  for (const file of missing) console.log(`  - ${file}`)
}
