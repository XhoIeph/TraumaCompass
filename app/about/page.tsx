import Link from 'next/link'
import { disorders, hospitals, provinces, publicReports } from '@/lib/data'

export const metadata = {
  title: '关于与方法｜TraumaCompass',
  description: '项目目标、ICD-11/ICD-10 落差说明、数据来源与核验标准、隐私与脱敏做法、撤下与更正流程。',
}

const NPM_REPO = 'https://github.com/XhoIeph/TraumaCompass'

export default function AboutPage() {
  return (
    <div>
      <h1>关于与方法</h1>

      <div className="tc-card">
        <h2>这个项目想解决什么</h2>
        <p>
          ICD-11 把「复杂性创伤后应激障碍（CPTSD）」列为独立诊断，而 ICD-10
          体系里没有对应类目。国内医疗机构的诊断书写与医保结算长期以 ICD-10
          及医保版编码为主，结果是：<strong>许多人符合 CPTSD 的描述，却在就诊时拿不到这个诊断</strong>，
          只能被记成 PTSD、抑郁、焦虑，或干脆被归到人格障碍里。
        </p>
        <p>
          这个项目用一张全国地图，把两件事同时呈现出来：
          <strong>哪些机构有可核实的创伤相关评估与诊断能力</strong>，
          以及<strong>网友在公开平台上留下的真实就诊路径</strong>（去了哪家医院、挂了什么科、遇到什么医生、花了多少、什么体验）。
          目标不是做导医排名，而是让「去哪里、能不能被听懂」这件事变得可检索。
        </p>
      </div>

      <div className="tc-card">
        <h2>ICD-11 与 ICD-10 的落差（首期条目）</h2>
        <table className="tc-table">
          <thead>
            <tr>
              <th>疾病</th>
              <th>ICD-11</th>
              <th>ICD-10</th>
              <th>落差方向</th>
            </tr>
          </thead>
          <tbody>
            {disorders.map((disorder) => (
              <tr key={disorder.id}>
                <td>
                  {disorder.name_zh}
                  {!disorder.visible && <span className="tc-faint">（未上线）</span>}
                </td>
                <td>
                  {disorder.icd11_code}
                  {disorder.code_review_status === 'pending_review' && (
                    <span className="tc-badge tc-badge--unverified" style={{ marginLeft: 6 }}>
                      待核对
                    </span>
                  )}
                </td>
                <td>{disorder.icd10_equivalent ?? '无对应类目'}</td>
                <td className="tc-small">
                  {disorder.icd11_only ? 'ICD-11 可诊断、ICD-10 无' : '两者皆有（ICD-11 判定方式有变）'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="tc-note tc-note--warn" style={{ marginTop: 'var(--tc-space-3)' }}>
          <strong>关于 BPD 的重要更正：</strong>
          边缘型人格障碍<em>不属于</em>「ICD-11 新增、ICD-10 没有」的病症，方向恰好相反 ——
          ICD-10 有明确的 F60.3 类目，ICD-11 则取消独立类目，改以「人格障碍严重度（6D10）+ 特质/模式限定词（6D11.x，
          其中 6D11.5 为边缘模式）」的维度化模型表达。本站收录 BPD，
          是因为它是国内门诊最常见的创伤相关诊断之一、且与 CPTSD 存在大量鉴别争议。
          所有编码在上线前都会在 WHO ICD-11 浏览器逐条核对，未核对的条目标注「待核对」。
        </div>
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
            用于核实机构与医生的客观信息。
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
          <li>
            <strong>不记录用户名</strong>：既不留真实昵称，也不留哈希别名（早期版本做过哈希化，现已全部移除）。
          </li>
          <li>
            <strong>不记录 IP 属地</strong>：平台显示的属地不等于就诊地，属于不必要的个人信息，采集端已停止读取。
          </li>
          <li>
            <strong>地区只分两类</strong>：医院所在地（来自机构信息）与作者自述所在地（原文明确写出时），
            页面上分别标注。
          </li>
          <li>
            <strong>医生相关信息</strong>：只收录公开执业信息（姓名、科室、职称、专长）。
            网友评价以摘录形式呈现并附原帖链接，不作为事实陈述，
            <strong>不参与任何排序或推荐</strong>，本站不接付费排名或导流。
          </li>
          <li>
            <strong>不做诊断建议</strong>：本站不是医疗机构，不提供诊断、治疗或用药建议。
          </li>
          <li>
            <strong>排除内容</strong>：涉及未成年人的可识别信息、自伤/自杀方式细节、病历号与就诊卡号、
            联系方式等一律不予发布；命中这些标记的线索会被保留编号但下线内容。
          </li>
        </ul>
      </div>

      <div className="tc-card">
        <h2>撤下与更正</h2>
        <p>
          如果你是被收录内容的当事人（包括被提及的医生），并认为某条记录不准确、过时或不应公开，
          可以通过 GitHub Issue 提交撤下或更正请求，我们会尽快处理并在数据中保留处理痕迹
          （记录编号保留、内容下线，或按你的要求更正）。
        </p>
        <div className="tc-row">
          <a className="tc-button" href={`${NPM_REPO}/issues/new?template=takedown.yml`} target="_blank" rel="noopener noreferrer">
            提交撤下请求
          </a>
          <a className="tc-button" href={`${NPM_REPO}/issues/new?template=correction.yml`} target="_blank" rel="noopener noreferrer">
            提交更正
          </a>
        </div>
      </div>

      <div className="tc-card">
        <h2>地图与合规说明</h2>
        <ul>
          <li>底图为<strong>示意性质的非标准地图</strong>，不用于任何测绘或行政用途；公开宣传前将替换为自然资源部标准地图服务底图并标注审图号。</li>
          <li>地图按省级行政区着色，首版不标注机构坐标点，避免把线索精确定位到医院门牌造成误导。</li>
          <li>「线索密度」是网友自述条数，<strong>不是确诊人数统计</strong>，也不能用于地区间比较。</li>
        </ul>
      </div>

      <div className="tc-card">
        <h2>免责声明与求助渠道</h2>
        <p>
          本站内容仅供信息参考，不构成医疗建议。任何诊断与治疗决定请咨询精神科执业医师。
          如果你正处于危机中，请拨打全国统一心理援助热线 <strong>12356</strong>
          （国家卫生健康委统一号码），或前往就近医院急诊。
        </p>
        <p className="tc-small tc-faint">
          本项目以 Apache-2.0 许可开源，数据格式与采集流程均公开可审计。
          <a href={NPM_REPO} target="_blank" rel="noopener noreferrer"> 查看代码与数据规范 ↗</a>
        </p>
        <p className="tc-small">
          <Link href="/submit/">想补充公开来源？点这里 →</Link>
        </p>
      </div>
    </div>
  )
}
