import { RibbonMark } from '@/components/Brand'

const PROSE = { maxWidth: '76ch' }

export const metadata = {
  title: '关于项目｜TraumaCompass',
  description:
    'TraumaCompass 的项目目的、数据来源与方法、隐私原则、非医疗建议声明、更新方式与地图合规说明。',
}

export default function AboutPage() {
  return (
    <div style={PROSE}>
      <div style={{ marginBottom: 16 }}>
        <RibbonMark height={60} />
      </div>
      <h1>关于 TraumaCompass</h1>
      {/* 后续关于项目的正文统一从这里开始添加。 */}
    </div>
  )
}
