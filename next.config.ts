import type { NextConfig } from 'next'

/**
 * GitHub Pages 项目站点部署在 https://<user>.github.io/<repo>/ 子路径下，
 * 因此构建时必须同时设置 basePath 与 assetPrefix。本地开发保持根路径。
 */
const REPO_NAME = 'TraumaCompass'
const onGitHubPages = process.env.GITHUB_PAGES === 'true'
const basePath = onGitHubPages ? `/${REPO_NAME}` : ''

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: onGitHubPages ? `${basePath}/` : undefined,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
}

export default nextConfig
