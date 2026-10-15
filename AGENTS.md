# TraumaCompass

- Read `docs/cloud-handoff.md` when continuing this project in a new environment.
- Use Node.js 24 and the committed npm lockfile. Validate with `npm run data:validate`, `npm run typecheck`, and `npm run build` when changing application code or data.
- Preserve source wording and comment context. `source_topics` are original-source labels, not verified diagnoses. Do not infer a diagnosis from a post title.
- Never commit `.env.local`, credentials, browser sessions, or `data/raw/`. Raw source capture is incomplete; do not describe it as a complete post backup.
- Do not merge or deploy an in-progress checkpoint merely because it builds. Check the remaining work in the handoff first.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
