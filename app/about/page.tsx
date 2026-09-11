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
        <h2>核验等级怎么定义</h2>
        <table className="tc-table">
          <thead>
            <tr>
              <th>等级</th>
              <th>含义</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="tc-badge tc-badge--official">官方来源</span>
              </td>
              <td>至少有一个官方来源（医院官网 / 卫健委等）可核实相关事实。</td>
            </tr>
            <tr>
              <td>
                <span className="tc-badge tc-badge--corroborated">多源印证</span>
              </td>
              <td>两条及以上相互独立的公开线索指向同一事实，但没有官方来源。</td>
            </tr>
            <tr>
              <td>
                <span className="tc-badge tc-badge--unverified">未核实</span>
              </td>
              <td>单条网友自述，未经核实。请只当作线索，不要当作结论。</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="tc-card">
        <h2>隐私、脱敏与对医生的公平性</h2>
        <ul>
          <li>
            <strong>发言者匿名化</strong>：平台昵称一律做哈希处理（本站只显示形如「薯友·a1b2c3」的别名），
            不保存、不公开平台账号 ID。原始文本与真实昵称只保留在本地采集目录，不进入公开仓库。
          </li>
          <li>
            <strong>地区标注分三类</strong>：医院所在地、作者自述地区、平台显示 IP 属地 —— 三者含义不同，
            页面上会明确区分，避免把 IP 属地误读为居住地。
          </li>
          <li>
            <strong>医生相关信息</strong>：只收录公开执业信息（姓名、科室、职称、专长）。
            网友评价一律以「个人体验，未经核实」的摘录形式呈现并附原帖链接，不作为事实陈述，
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
