import Link from 'next/link'
import { hospitals, provinces, publicReports } from '@/lib/data'

export const metadata = {
  title: '关于与方法｜TraumaCompass',
  description: '项目目标、数据来源与采集边界、隐私与脱敏做法、撤下与更正流程。',
}

const NPM_REPO = 'https://github.com/XhoIeph/TraumaCompass'

export default function AboutPage() {
  return (
    <div>
      <h1>关于与方法</h1>

      <div className="tc-card">
        <h2>这个项目想解决什么</h2>
        <p>
          这个项目用一张全国地图，把两件事同时呈现出来：
          <strong>哪些机构有公开依据支持其创伤相关评估与诊断服务</strong>，
          以及<strong>网友在公开平台上留下的真实就诊路径</strong>（去了哪家医院、挂了什么科、遇到什么医生、花了多少、什么体验）。
          目标不是做导医排名，而是让「去哪里、能不能被听懂」这件事变得可检索。
        </p>
      </div>

      <div className="tc-card">
        <h2>数据从哪里来</h2>
        <ol>
          <li>
            <strong>公开平台的自述内容</strong>：小红书、知乎等平台上公开可见的笔记、回答与评论。
            我们只读取<strong>公开内容</strong>，通过已登录的真实浏览器会话进行低频、人类节奏的检索，
            不逆向接口、不绕过风控、不采集私信或任何非公开内容。
          </li>
          <li>
            <strong>官方来源</strong>：医院官网、国家卫生健康委及地方卫健委公开信息、医院等级与执业信息公示，
            用于建立机构与医生的客观信息记录。
          </li>
          <li>
            <strong>公开网页与用户提交</strong>：新闻、科普文章、以及通过 GitHub Issue 提交的公开来源。
          </li>
        </ol>
        <p className="tc-small tc-muted">
          当前数据集：{hospitals.length} 家机构、{publicReports.length} 条已发布线索、
          {provinces.length} 个省级行政区底图。这是一份<strong>早期样本</strong>，
          分布不均属于正常现象，不代表任何地区的真实服务水平。
        </p>
      </div>

      <div className="tc-card">
        <h2>我们不做「核实」，也做不到</h2>
        <p>
          早期版本给线索打过「未核实 / 多源印证 / 官方来源」的标签，这个做法已经取消：
          <strong>网友自述是无法核实的</strong> —— 要「核实」就得去调取医院诊断记录或人肉评论者，
          前者不合法，后者是伤害。因此本站不再对任何个人陈述做真伪判定。
        </p>
        <p>取而代之的是三条可自行检验的信息：</p>
        <ul>
          <li><strong>原帖链接</strong>：每条线索都能点回原帖，你可以自己读上下文；</li>
          <li><strong>机构侧的公开依据</strong>：医院官网、卫健委、联盟名单等，逐条列在机构页面；</li>
          <li><strong>并列呈现</strong>：同一事实有多个来源就都放上去，包括相互矛盾的，不由我们替你下结论。</li>
        </ul>
      </div>

      <div className="tc-card">
        <h2>隐私：不记录任何用户标识</h2>
        <ul>
          <li><strong>不记录用户名</strong>：既不留真实昵称，也不留哈希别名（早期版本做过哈希化，现已全部移除）。</li>
          <li><strong>不记录 IP 属地</strong>：平台显示的属地不等于就诊地，属于不必要的个人信息，采集端已停止读取。</li>
          <li><strong>地区只分两类</strong>：医院所在地（来自机构信息）与作者自述所在地（原文明确写出时），页面上分别标注。</li>
          <li><strong>医生相关信息</strong>：只收录公开执业信息（姓名、科室、职称、专长）。网友评价以摘录形式呈现并附原帖链接，不作为事实陈述，<strong>不参与任何排序或推荐</strong>，本站不接付费排名或导流。</li>
          <li><strong>不做诊断建议</strong>：本站不是医疗机构，不提供诊断、治疗或用药建议。</li>
          <li><strong>排除内容</strong>：涉及未成年人的可识别信息、自伤/自杀方式细节、病历号与就诊卡号、联系方式等一律不予发布；命中这些标记的线索会被保留编号但下线内容。</li>
        </ul>
      </div>

      <div className="tc-card">
        <h2>撤下与更正</h2>
        <p>
          如果你是被收录内容的当事人（包括被提及的医生），并认为某条记录不准确、过时或不应公开，
          可以通过 GitHub Issue 提交撤下或更正请求，我们会尽快处理并在数据中保留处理痕迹（记录编号保留、内容下线，或按你的要求更正）。
        </p>
        <div className="tc-row">
          <a className="tc-button" href={`${NPM_REPO}/issues/new?template=takedown.yml`} target="_blank" rel="noopener noreferrer">提交撤下请求</a>
          <a className="tc-button" href={`${NPM_REPO}/issues/new?template=correction.yml`} target="_blank" rel="noopener noreferrer">提交更正</a>
        </div>
      </div>

      <div className="tc-card">
        <h2>地图与合规说明</h2>
        <ul>
          <li>首页优先使用天地图官方标准地图服务；未配置 key 时回退为<strong>示意性质的非标准地图</strong>，不用于测绘或行政用途。</li>
          <li>地图按省级展示公开线索采集密度，颜色深浅<strong>不是就诊或确诊人数统计</strong>，也不能用于地区间比较。</li>
          <li>医院节点的坐标为<strong>省级近似位置</strong>（`coordinates_source: province-centroid`），同省机构按环形展开，<strong>不是门址</strong>。</li>
        </ul>
      </div>

      <div className="tc-card">
        <h2>免责声明与求助渠道</h2>
        <p>
          本站内容仅供信息参考，不构成医疗建议。任何诊断与治疗决定请咨询精神科执业医师。
          如果你正处于危机中，请拨打全国统一心理援助热线 <strong>12356</strong>（国家卫生健康委统一号码），或前往就近医院急诊。
        </p>
        <p className="tc-small tc-faint">
          本项目以 Apache-2.0 许可开源，数据格式与采集流程均公开可审计。
          <a href={NPM_REPO} target="_blank" rel="noopener noreferrer"> 查看代码与数据规范 ↗</a>
        </p>
        <p className="tc-small"><Link href="/submit/">想补充公开来源？点这里 →</Link></p>
      </div>
    </div>
  )
}
