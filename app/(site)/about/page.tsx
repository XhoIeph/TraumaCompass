import Link from 'next/link'
import { RibbonMark } from '@/components/Brand'
import { doctors, hospitals, provinceStats, publicReports } from '@/lib/data'

const REPO_URL = 'https://github.com/XhoIeph/TraumaCompass'
const ISSUE_URL = `${REPO_URL}/issues/new`

/** 章节间距 24px、正文列 76ch：与详情页的排版口径保持一致 */
const SECTION = { marginTop: 24 }
const PROSE = { maxWidth: '76ch' }

export const metadata = {
  title: '关于项目｜TraumaCompass',
  description:
    'TraumaCompass 的项目目的、数据来源与方法、隐私原则、非医疗建议声明、更新方式与地图合规说明。',
}

export default function AboutPage() {
  const totals = provinceStats.totals
  const snapshotDate = provinceStats.generated_at.slice(0, 10)

  return (
    <div style={PROSE}>
      <div style={{ marginBottom: 16 }}>
        <RibbonMark height={60} />
      </div>
      <h1>关于 TraumaCompass</h1>
      <p>
        TraumaCompass 是一张全国性的创伤知情就诊地图：把公开可见的就诊经历，与有官方来源支撑的机构信息整理到一起，
        让「符合描述、却不知道该去哪里」的人少走一段弯路。
      </p>

      <div className="tc-row">
        <span className="tc-badge tc-badge--accent">就诊线索 {publicReports.length} 条</span>
        <span className="tc-badge tc-badge--neutral">机构 {hospitals.length} 家</span>
        <span className="tc-badge tc-badge--neutral">
          覆盖 {totals.provinces_with_reports} 个省级行政区
        </span>
      </div>

      <p className="tc-meta" style={{ marginTop: 8 }}>
        当前数据快照生成于 {snapshotDate}，另有 {totals.reports_unlocated} 条线索暂时无法归属到具体省份。
        项目处于早期版本，收录范围与数据量都还很小。
        <Link href="/">在地图中查看线索分布 →</Link>
      </p>

      <h2 style={SECTION}>为什么做这个项目</h2>
      <p>
        ICD-11 把复杂性创伤后应激障碍（CPTSD，6B41）列为独立诊断，ICD-10 体系中没有对应类目；
        国内临床诊断书写与医保结算长期以 ICD-10 及医保版编码为主。结果是：符合描述的人往往拿不到这个诊断，
        也不知道该向谁求助。
      </p>
      <p>
        本项目不打算替这个落差给出医学结论，只做一件具体的事：把「哪里可能看得到」和「别人实际是怎么走过来的」
        整理成可以查阅、可以追溯来源的公开信息。
      </p>
      <p>
        首期只覆盖 CPTSD 与 BPD。需要说明的是，BPD 并不属于「ICD-11 新增」的情形：ICD-10 已有 F60.3，
        ICD-11 改为严重度与特质限定词的写法。收录它，是因为两者在临床上存在大量鉴别争议。
      </p>

      <h2 style={SECTION}>数据从哪里来</h2>
      <table className="tc-table">
        <thead>
          <tr>
            <th>来源</th>
            <th>具体内容</th>
            <th>怎么用</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              公开平台自述
              <br />
              （小红书为主源，知乎为副源）
            </td>
            <td>公开可见的笔记、回答与评论</td>
            <td>只读取公开可见内容；以逐字摘录（≤200 字）加原帖链接呈现</td>
          </tr>
          <tr>
            <td>官方来源</td>
            <td>医院官网、国家及地方卫生健康委公开信息、医院等级与执业信息公示</td>
            <td>机构条目的依据；医生的姓名、科室、职称等客观信息也必须有官方来源才会建立条目</td>
          </tr>
          <tr>
            <td>公开网页与用户提交</td>
            <td>新闻、科普文章，以及通过 GitHub Issue 提交的公开来源</td>
            <td>与线索同等处理：必须有可追溯的原始链接</td>
          </tr>
        </tbody>
      </table>
      <p className="tc-small tc-muted">
        采集通过已登录的真实浏览器会话进行，由页面自身完成站点所需的校验；
        不逆向接口、不绕过验证码或风控，也不采集私信、群聊、付费社群等非公开内容。
      </p>

      <h2 style={SECTION}>方法与边界</h2>
      <p>站点上同时有两条信息线，它们的含义不同，不能互相推断：</p>
      <table className="tc-table">
        <thead>
          <tr>
            <th>图层</th>
            <th>含义</th>
            <th>不能用来推断</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>机构与公开执业信息</td>
            <td>有官方来源支撑的机构、科室与服务方向</td>
            <td>当地真实的医疗水平；有公开依据也不等于一定能开出 CPTSD 诊断</td>
          </tr>
          <tr>
            <td>就诊线索密度</td>
            <td>公开线索的采集条数</td>
            <td>确诊人数、就诊人数或患病率，也不能用于地区之间的排名</td>
          </tr>
        </tbody>
      </table>
      <p>「没有记录」只表示我们没有收集到可追溯的来源，不表示当地没有资源。</p>
      <p>
        本站不对网友自述作真伪判定，也不给内容打可信度标签。每条线索给出的是原帖链接、逐字摘录，
        以及机构一侧的公开依据；出现相互矛盾的说法时并列呈现，由读者自行判断。
      </p>
      <p>
        网友提到的医生姓名只来自线索原文，不代表执业资格认证、服务保证或推荐。
        目前公开执业信息条目为 {doctors.length} 条，这是刻意保持的保守状态：先把机构与线索跑通，
        再在有公开执业信息支撑时逐个补充。
      </p>

      <h2 style={SECTION}>隐私原则</h2>
      <ul>
        <li>
          <strong>最小化收集</strong>：只保留与就诊路径直接相关的字段，不收集身份证号、病历号、就诊卡号、
          联系方式与住址门牌。
        </li>
        <li>
          <strong>不记录用户标识</strong>：昵称、账号与 IP 属地一律不采集、不保存；平台 IP 属地不参与地区归属判断。
        </li>
        <li>
          <strong>不建立个人档案</strong>：精神健康状况属于敏感个人信息，本站只保留单条公开自述的摘录与链接，
          不把同一作者的多条内容聚合成画像。
        </li>
        <li>
          <strong>不采集非公开内容</strong>：私信、群聊、付费社群、仅好友可见的内容一律不采。
        </li>
        <li>
          <strong>未成年人保护</strong>：涉及未成年人的可识别信息，以及自伤、自杀的方式细节不会发布；
          构建阶段的数据校验会拦截这类记录。
        </li>
        <li>
          <strong>撤下与更正</strong>：当事人（包括被提及的医生与机构）可以随时申请撤下或更正；
          涉及隐私的请求先下线，再讨论后续处理。
        </li>
      </ul>

      <h2 style={SECTION}>这不是医疗建议</h2>
      <div className="tc-note tc-note--warn">
        <p>
          TraumaCompass 是信息整理项目，<strong>不构成医疗建议</strong>：不做诊断，不推荐治疗方案或药物，
          不提供挂号、导医或转介服务，也不接付费排名与推广。
        </p>
        <p style={{ marginBottom: 0 }}>
          是否适合某类评估或治疗，请以精神科、心理科执业医师的面诊意见为准。
          如果你此刻处于危机中，或出现过伤害自己的念头，请先联系当地急救，
          或拨打全国统一心理援助热线 <a href="tel:12356">12356</a>。
        </p>
      </div>

      <h2 style={SECTION}>已知局限</h2>
      <ul>
        <li>样本量小、地域分布不均，任何比较性结论都不成立；地图上的色块深浅只是采集密度。</li>
        <li>图文笔记的正文可能写在图片里，首期不做 OCR，因此一定有遗漏。</li>
        <li>小红书原帖链接中的临时参数会过期，公开数据只保留规范链接，部分原帖可能已经打不开。</li>
        <li>机构坐标为省级近似位置，不定位到门牌，避免把线索落到具体楼宇。</li>
        <li>平台规则变化可能导致采集通道失效，届时会退回人工录入，字段标准不变。</li>
      </ul>

      <h2 style={SECTION}>更新方式</h2>
      <p>
        数据与页面一起以静态站点形式发布：公开来源先经过字段校验与隐私红线检查，再生成省级聚合数据，
        最后随站点一起构建出来。来源链接会定期巡检，失效或已删除的原帖会下线，记录编号保留。
      </p>
      <p>
        更新不承诺频率：有新的公开来源、更正或撤下请求时才会重新发布，每次发布都会重新校验一遍全部数据。
        当前这次快照生成于 {snapshotDate}。
      </p>

      <h2 style={SECTION}>地图与合规说明</h2>
      <ul>
        <li>
          配置了天地图 key 时，底图使用天地图（国家地理信息公共服务平台）瓦片；未配置 key 时自动回退为
          以省级边界绘制的示意底图，功能一致。
        </li>
        <li>
          回退底图是示意性质的非标准地图，页面图例中明确标注「示意底图 · 非标准地图」；
          正式对外推广前会按天地图使用条款与审图号标注要求逐项核对。
        </li>
        <li>
          省级色块表示公开线索的采集密度，不代表就诊人数或确诊人数；机构坐标为省级近似位置，不定位到具体楼宇。
        </li>
        <li>站点为静态导出，不设账号，也不加载第三方统计或广告脚本。</li>
      </ul>

      <h2 style={SECTION}>参与这个项目</h2>
      <p>
        项目早期由发起者与 AI 协作维护。欢迎通过 GitHub Issue 提交线索、更正与撤下请求，
        也欢迎指出方法与口径上的问题。
      </p>
      <div className="tc-row">
        <a className="tc-button" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          项目仓库 ↗
        </a>
        <a
          className="tc-button"
          href={`${ISSUE_URL}?template=lead.yml`}
          target="_blank"
          rel="noopener noreferrer"
        >
          提交线索 ↗
        </a>
        <a
          className="tc-button"
          href={`${ISSUE_URL}?template=correction.yml`}
          target="_blank"
          rel="noopener noreferrer"
        >
          更正记录 ↗
        </a>
        <a
          className="tc-button"
          href={`${ISSUE_URL}?template=takedown.yml`}
          target="_blank"
          rel="noopener noreferrer"
        >
          申请撤下 ↗
        </a>
      </div>
      <p className="tc-small tc-muted" style={{ marginTop: 12 }}>
        投稿的具体要求见 <Link href="/submit/">提交线索</Link>。
        代码与数据结构以 Apache-2.0 发布；线索摘录的版权属于原作者，
        本站只做不超过 200 字的有限引用并附原帖链接，不转载全文、不镜像图片。
      </p>
    </div>
  )
}

