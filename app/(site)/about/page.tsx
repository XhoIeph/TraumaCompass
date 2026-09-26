import { RibbonMark } from '@/components/Brand'

export const metadata = {
  title: '关于项目｜TraumaCompass',
  description:
    'TraumaCompass 的项目目的、数据来源与方法、隐私原则、非医疗建议声明、更新方式与地图合规说明。',
}

export default function AboutPage() {
  return (
    <div className="tc-about">
      <RibbonMark height={80} />
      <h1>关于 TraumaCompass</h1>
      {/* 后续关于项目的正文统一从这里开始添加。 */}
    </div>
  )
}
