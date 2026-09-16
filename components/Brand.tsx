import Link from 'next/link'

/**
 * 共享品牌组件：青绿色意识丝带 + 站名 TraumaCompass，整体是回首页的链接。
 * 按 2026-09-16 UI/UX 调整任务书 P1-0 实现：
 * - 图形资产 public/brand/traumacompass-ribbon.svg（原图 912×1280 竖向、单色 #008080）。
 *   以高度控制尺寸、宽度按 912:1280 自动计算，禁止拉伸/裁切/旋转/描边/加底板。
 * - 丝带与可见站名相邻 → 装饰图（alt="" + aria-hidden），链接可访问名称由可见文本提供。
 * - 显式写出 width/height 与 aspect-ratio，避免图片加载前后布局位移。
 * - 服务端组件（无 'use client'）；不使用 next/image，静态资源路径由 basePath 手动拼接。
 *
 * 版式说明（已在 Chromium 实测，非猜测）：
 * - 链接用 display:inline-block，使其作为 flex item 时基线 = 第一个行盒的基线；
 *   丝带用 vertical-align:middle 与站名行垂直居中。
 * - 文字列刻意用 inline-flex 纵向排布：inline-block 的基线取“最后一个行盒”（会变成副标题基线），
 *   而 inline-flex 的基线取“第一个 flex item”（即站名），因此有/无副标题时链接基线都等于站名基线，
 *   放进 align-items: baseline 的页头（app/globals.css 的 .tc-header-inner）不会错位，
 *   页头行高与改造前一致（实测 73.5px，未因加 Logo 而增高）。
 */

/** 源 SVG 的 viewBox 尺寸，决定固定纵横比 */
const RIBBON_WIDTH = 912
const RIBBON_HEIGHT = 1280
const RIBBON_ASPECT_RATIO = `${RIBBON_WIDTH} / ${RIBBON_HEIGHT}`

/** 丝带与站名间距（px），任务书要求 8–10px */
const LOGO_GAP = 10

/** 品牌组合最小高度（px），保证可点击/触控区域 ≥44×44px */
const MIN_TOUCH_TARGET = 44

/**
 * next.config.ts 通过 env 注入 NEXT_PUBLIC_BASE_PATH：
 * 本地开发为 ''（根路径），GitHub Pages 项目站点为 '/TraumaCompass'。
 * 去掉可能存在的结尾斜杠，避免拼出 '//brand/...'。
 */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').replace(/\/+$/, '')
const RIBBON_SRC = `${BASE_PATH}/brand/traumacompass-ribbon.svg`

export type BrandProps = {
  /** 丝带高度（px），宽度按 912:1280 自动计算；默认 28 */
  height?: number
  /** 站名下方的辅助小字（渲染为 <small>）；省略时不渲染 */
  subtitle?: string
  /** 追加到 .tc-brand 之后的类名，用于按场景微调间距/字号 */
  className?: string
}

export function Brand({ height = 28, subtitle, className }: BrandProps) {
  // 属性上的 width/height 给出加载前的固有尺寸提示；实际尺寸由行内样式 + aspect-ratio 决定
  const intrinsicWidth = Math.round((height * RIBBON_WIDTH) / RIBBON_HEIGHT)
  const linkClassName = className ? `tc-brand ${className}` : 'tc-brand'

  return (
    <Link
      href="/"
      className={linkClassName}
      style={{ display: 'inline-block', minHeight: MIN_TOUCH_TARGET }}
    >
      {/* 丝带与文字列之间不能有空白文本节点，间距只由 marginRight 控制 */}
      <img
        src={RIBBON_SRC}
        alt=""
        aria-hidden="true"
        width={intrinsicWidth}
        height={height}
        decoding="async"
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          marginRight: LOGO_GAP,
          width: 'auto',
          height: `${height}px`,
          aspectRatio: RIBBON_ASPECT_RATIO,
        }}
      /><span style={{ display: 'inline-flex', flexDirection: 'column' }}>
        <span>TraumaCompass</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
    </Link>
  )
}

export default Brand

/**
 * 独立品牌图形（用于 /about/ 标题区等不与站名并排、也不作为链接的场景）。
 * 与 Brand 共用同一份资产与 basePath 逻辑；此处图形是页面主标识，因此给出真实 alt。
 */
export function RibbonMark({ height = 60, className }: { height?: number; className?: string }) {
  const intrinsicWidth = Math.round((height * RIBBON_WIDTH) / RIBBON_HEIGHT)
  return (
    <img
      src={RIBBON_SRC}
      alt="TraumaCompass 青绿色意识丝带标识"
      width={intrinsicWidth}
      height={height}
      decoding="async"
      className={className}
      style={{
        display: 'block',
        width: 'auto',
        height: `${height}px`,
        aspectRatio: RIBBON_ASPECT_RATIO,
      }}
    />
  )
}

