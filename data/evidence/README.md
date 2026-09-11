# 证据归档（Evidence archive）

这里存放从公开平台采集到的**原始截图与图片证据**，用于支撑 `data/curated/reports.json` 中的线索。
公开仓库需要能追溯「这句话是从哪来的」，光有链接不够 —— 原帖可能被删、图片可能被替换。

## 目录结构

```
data/evidence/
├─ manifest.json       # 机器可读清单：shasum、字节数、来源帖、图片直链、内容说明与转写摘要
├─ descriptions.json   # 人工撰写的说明与转写（manifest 由它 + 实际文件生成）
└─ <platform>/<post-id>/*.webp
```

## 规则

1. **只归档公开内容**：全部来自公开笔记的正文图片或公开评论区的图片。
2. **保留出处**：每张图在 `manifest.json` 里都有 `source_post_url`、`source_image_url`、`captured_at`。
3. **逐字转写**：涉及医疗信息的截图必须提供 `transcription`，便于检索与复核；
   转写与图片不一致时**以图片为准**。
4. **不强加结论**：图片内容多为他人的主观推荐或自述，站点的 `verification.level` 仍按线索规则标注。
5. **版权与撤下**：图片版权属于原作者。若原作者或当事人要求撤下，按
   [docs/takedown.md](../../docs/takedown.md) 处理（记录编号保留、图片与内容下线）。

## 生成方式

```powershell
node scripts/collect/build-evidence-manifest.ts
```

该脚本会遍历 `data/evidence/**`，为每个文件计算 SHA-256 并与 `descriptions.json` 合并写出 `manifest.json`。
