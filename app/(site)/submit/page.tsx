import Link from 'next/link'
import { hospitals, publicReports } from '@/lib/data'

const REPO_URL = 'https://github.com/XhoIeph/TraumaCompass'
const TEMPLATE_URL = `${REPO_URL}/issues/new?template=`

/** 章节间距 24px、正文列 76ch：与详情页的排版口径保持一致 */
const SECTION = { marginTop: 24 }
const PROSE = { maxWidth: '76ch' }

export const metadata = {
  title: '提交线索｜TraumaCompass',
  description:
    '可以提交的内容、禁止提交的隐私信息，以及线索、更正、撤下三个 GitHub Issue 模板入口与地图投稿面板。',
}

export default function SubmitPage() {
  return (
    <div style={PROSE}>
      <h1>提交线索</h1>
      <p>
        这里收集公开可查的就诊线索：公开帖子、公开网页或官方公示里出现的机构、科室、医生与就诊过程。
        投稿先经人工复核，确认来源可以打开、且不含任何人的隐私信息，才会进入数据集。
      </p>
      <p className="tc-meta">
        目前公开收录 {publicReports.length} 条线索、{hospitals.length} 家机构。
        投稿不需要你为内容的真实性负责，只需要它是公开的、能追溯到原始链接。
      </p>

      <div className="tc-note tc-note--warn">
        <strong>请不要提交任何人的隐私信息。</strong>
        含病历号、就诊卡号、联系方式、未成年人可识别信息或自伤细节的提交会被直接关闭，不会进入数据集。
        如果是要撤回自己或当事人的内容，请直接走「申请撤下」，原因可以不公开说明。
      </div>

      <h2 style={SECTION}>可以提交什么</h2>
      <ul>
        <li>公开可访问的原帖链接：小红书、知乎、微博、豆瓣、贴吧等平台都可以。</li>
        <li>逐字摘录（不超过 200 字）：直接复制原文，不要改写、总结或补写原文没有的信息。</li>
        <li>公开内容里出现的医院、科室、医生姓名 —— 照原文写法填写即可。</li>
        <li>就诊过程：怎么挂号、等了多久、大致费用、做过哪些评估、医生如何回应。</li>
        <li>官方来源链接：医院官网、卫生健康委公开信息、执业注册信息查询结果。</li>
        <li>更正与撤下请求：数据写错了、机构信息过时了，或者这条内容涉及你本人。</li>
      </ul>
      <p className="tc-small tc-muted">
        只写你愿意公开的部分。摘录会以脱敏形式呈现并附上原帖链接，不会出现昵称、账号或 IP 属地。
      </p>

      <h2 style={SECTION}>禁止提交的隐私信息</h2>
      <p>以下内容不要写进 Issue、评论或任何公开位置 —— 一旦发出就很难收回：</p>
      <ul>
        <li>
          <strong>身份与就诊凭证</strong>：病历号、就诊卡号、身份证号、医保信息、检查报告编号。
        </li>
        <li>
          <strong>联系方式</strong>：手机号、微信号、邮箱、住址门牌。
        </li>
        <li>
          <strong>未成年人可识别信息</strong>：姓名、学校、班级、照片、就诊记录。
        </li>
        <li>
          <strong>自伤或自杀细节</strong>：方式、剂量、工具、具体时间地点。
        </li>
        <li>
          <strong>非公开内容</strong>：私信、群聊、付费社群、仅好友可见的内容。
        </li>
        <li>
          <strong>他人的诊断与病历</strong>：诊断记录、处方、检查报告、影像或照片。
        </li>
        <li>
          <strong>无法追溯来源的转述</strong>：例如「我朋友说」，却没有原帖链接。
        </li>
      </ul>
      <p className="tc-small tc-faint">
        如果你已经公开了这类内容，请立即走撤下流程；涉及隐私的请求我们会先下线，再讨论后续处理。
      </p>

      <h2 style={SECTION}>怎么提交</h2>
      <div className="tc-grid tc-grid--cards">
        <div className="tc-card">
          <h3>提交就诊线索</h3>
          <p className="tc-small tc-muted">
            提供原帖链接、平台与逐字摘录，以及原文出现的医院、科室、医生和就诊阶段。
          </p>
          <a
            className="tc-button tc-button--active"
            href={`${TEMPLATE_URL}lead.yml`}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开线索模板 ↗
          </a>
        </div>
        <div className="tc-card">
          <h3>更正记录</h3>
          <p className="tc-small tc-muted">
            疾病编码、机构名称与等级、医生科室职称写错，摘录与原文不符，或者地区归属有误。
          </p>
          <a
            className="tc-button"
            href={`${TEMPLATE_URL}correction.yml`}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开更正模板 ↗
          </a>
        </div>
        <div className="tc-card">
          <h3>申请撤下</h3>
          <p className="tc-small tc-muted">
            你本人是作者、被提及的医生，或机构的授权代表。原因不便公开时，只填记录编号即可。
          </p>
          <a
            className="tc-button"
            href={`${TEMPLATE_URL}takedown.yml`}
            target="_blank"
            rel="noopener noreferrer"
          >
            打开撤下模板 ↗
          </a>
        </div>
      </div>
      <p className="tc-meta">
        三个入口都在 GitHub 上，需要 GitHub 账号；Issue 内容是公开可见的，请不要在里面写隐私信息。
      </p>

      <h2 style={SECTION}>在地图中打开投稿面板</h2>
      <p>
        也可以从地图侧栏的「投稿」入口进入：先在地图上找到相关机构，再用下面的链接打开同一个投稿面板。
      </p>
      <p>
        <Link className="tc-button tc-button--active" href="/?panel=submit">
          在地图中打开投稿面板 →
        </Link>
      </p>
      <p className="tc-small tc-muted">
        该面板只提供跳转链接，不会自动收集、上传或保存你输入的任何内容；最终提交仍然发生在 GitHub。
      </p>

      <h2 style={SECTION}>提交之后会发生什么</h2>
      <ol>
        <li>
          <strong>人工复核</strong>：确认链接可以打开、摘录与原文一致、不含隐私信息。
        </li>
        <li>
          <strong>处理</strong>：符合收录标准的进入数据集；命中隐私红线的直接关闭，不会重复展示隐私内容。
        </li>
        <li>
          <strong>发布</strong>：随下一次站点构建生效。更正与撤下请求优先处理，撤下请求先下线再讨论。
        </li>
      </ol>
      <p className="tc-small tc-faint">
        不承诺处理时限与收录结果。本站不对线索内容作真伪判定，也不为任何机构或医生背书。
      </p>

      <h2 style={SECTION}>如果你现在需要帮助</h2>
      <div className="tc-note tc-note--info">
        投稿不急。如果你正处于危机中，或出现过伤害自己的念头，请先联系当地急救，
        或拨打全国统一心理援助热线 <a href="tel:12356">12356</a>。
        本站是信息整理项目，不构成医疗建议，也不做诊断或治疗推荐。
      </div>
    </div>
  )
}
