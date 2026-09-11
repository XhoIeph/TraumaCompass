import Link from 'next/link'

export const metadata = {
  title: '提交线索｜TraumaCompass',
  description: '通过 GitHub Issue 提交公开可查的就诊线索、机构信息补充或撤下请求。',
}

const REPO = 'https://github.com/XhoIeph/TraumaCompass'
const ISSUE_NEW = `${REPO}/issues/new`

export default function SubmitPage() {
  return (
    <div>
      <h1>提交线索</h1>
      <p className="tc-muted">
        本站只收录<strong>公开可查</strong>的来源。提交前请确认：这条信息来自公开帖子、公开网页或官方公示，
        而不是私聊、群聊内容或他人隐私。
      </p>

      <div className="tc-note tc-note--warn">
        <strong>请不要提交：</strong>未成年人的可识别信息、自伤/自杀方式细节、他人的病历号或就诊卡号、
        联系方式、私聊截图、任何未公开的内容。此类提交会被直接关闭。
      </div>

      <div className="tc-card">
        <h2>一条合格的线索包含什么</h2>
        <table className="tc-table">
          <tbody>
            <tr>
              <th>必需</th>
              <td>公开原帖链接（能直接打开）+ 一句逐字摘录（≤200 字）</td>
            </tr>
            <tr>
              <th>尽量提供</th>
              <td>平台、发表时间、医院、科室、医生、费用、就诊阶段（求医/已就诊/已确诊等）</td>
            </tr>
            <tr>
              <th>地区</th>
              <td>请说明是<strong>医院所在地</strong>、<strong>作者自述地区</strong>还是<strong>平台 IP 属地</strong>，三者不通用</td>
            </tr>
            <tr>
              <th>疾病</th>
              <td>CPTSD / BPD / OSDD / 其他（可多选）</td>
            </tr>
            <tr>
              <th>官方来源</th>
              <td>若涉及机构或医生的客观信息，请附医院官网或卫健委页面</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="tc-card">
        <h2>三种提交入口</h2>
        <div className="tc-stack">
          <p>
            <a className="tc-button" href={`${ISSUE_NEW}?template=lead.yml`} target="_blank" rel="noopener noreferrer">
              提交就诊线索
            </a>
            <span className="tc-small tc-muted"> 用表单填写平台、链接、摘录、医院与医生信息。</span>
          </p>
          <p>
            <a className="tc-button" href={`${ISSUE_NEW}?template=correction.yml`} target="_blank" rel="noopener noreferrer">
              更正已有记录
            </a>
            <span className="tc-small tc-muted"> 指出编码、机构信息或线索摘录中的错误。</span>
          </p>
          <p>
            <a className="tc-button" href={`${ISSUE_NEW}?template=takedown.yml`} target="_blank" rel="noopener noreferrer">
              申请撤下内容
            </a>
            <span className="tc-small tc-muted"> 当事人（含被提及的医生）可申请下线某条记录。</span>
          </p>
        </div>
        <p className="tc-small tc-faint">
          提交需要 GitHub 账号。所有 Issue 内容公开可见，请不要在其中填写任何隐私信息。
        </p>
      </div>

      <div className="tc-card">
        <h2>提交之后会发生什么</h2>
        <ol>
          <li>我们核对你给的原帖链接是否公开可访问、摘录是否与原文一致。</li>
          <li>录入时<strong>不会记录你和原帖作者的用户名、账号或 IP</strong>；站点只保留平台、时间、摘录与原帖链接。</li>
          <li>机构与医生的客观信息需要官方来源才会建立条目，否则只保留线索本身。</li>
          <li>如果同一事实有多条独立来源，我们会在页面上并列展示，让读者自己判断。</li>
        </ol>
        <p className="tc-small">
          <Link href="/about/">了解完整的核验标准与隐私处理方式 →</Link>
        </p>
      </div>
    </div>
  )
}
