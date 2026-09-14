import {
  ArrowSquareOutIcon as ArrowSquareOut, BroadcastIcon as Broadcast,
  ChatsCircleIcon as ChatsCircle,
} from '@phosphor-icons/react'
import { QuantSkillsBrandLockup } from './QuantSkillsBrand.tsx'
import pandaGroupAssistantQr from './assets/pandaai-group-assistant-qr.png'
import quantSkillsWechatQr from './assets/quantskills-wechat-qr.png'
import css from './QuantSkillsApp.module.css'

const QUANTSKILLS_SITE = 'https://www.quantskills.ai/'
const PANDAAI_SITE = 'https://www.pandaaiquant.com/'

/**
 * Render official brand, website, and community resources in one settings page.
 * @returns The static QuantSkills brand and support surface.
 */
export function QuantSkillsBrandSupportSettings() {
  return <div className={css.brandSupport}>
    <section className={css.brandSupportIntro}>
      <QuantSkillsBrandLockup/>
      <div>
        <h2>品牌与支持</h2>
        <p>QuantSkills 连接专业 技能、专家与 PandaAI，让量化研究更高效。</p>
      </div>
    </section>
    <section className={css.officialLinks} aria-labelledby="official-sites-heading">
      <div>
        <h3 id="official-sites-heading">官方网站</h3>
        <p>产品信息、公开能力目录和官方动态统一从这里进入。</p>
      </div>
      <a href={PANDAAI_SITE} target="_blank" rel="noopener noreferrer">
        <span><b>PandaAI 官网</b><small>pandaaiquant.com</small></span><ArrowSquareOut/>
      </a>
      <a href={QUANTSKILLS_SITE} target="_blank" rel="noopener noreferrer">
        <span><b>QuantSkills 官网</b><small>quantskills.ai</small></span><ArrowSquareOut/>
      </a>
    </section>
    <section className={css.supportCommunity} aria-labelledby="community-support-heading">
      <div>
        <h3 id="community-support-heading">社区与支持</h3>
        <p>二维码只在此页展示，不占用首页和工作区。</p>
      </div>
      <div className={css.qrGrid}>
        <article className={css.qrCard}>
          <span><ChatsCircle/><b>入群小助理</b></span>
          <img src={pandaGroupAssistantQr} alt="PandaAI 入群小助理二维码"/>
          <p>问题反馈、安装协助与用户群入口</p>
          <small>使用微信扫码</small>
        </article>
        <article className={css.qrCard}>
          <span><Broadcast/><b>官方公众号</b></span>
          <img src={quantSkillsWechatQr} alt="QuantSkills 官方公众号二维码"/>
          <p>关注产品更新、研究内容与活动通知</p>
          <small>使用微信扫码</small>
        </article>
      </div>
    </section>
  </div>
}

/**
 * Render the compact official brand and support surface used on the home page.
 * @returns The home-page brand panel with official links and support QR codes.
 */
export function QuantSkillsBrandSupportPanel() {
  return <aside className={css.brandHomePanel} aria-labelledby="home-brand-support-heading">
    <header>
      <QuantSkillsBrandLockup/>
      <div>
        <h2 id="home-brand-support-heading">品牌与支持</h2>
        <p>QuantSkills 连接专业 技能、专家与 PandaAI，让量化研究更高效。</p>
      </div>
    </header>
    <nav className={css.brandHomeLinks} aria-label="官方网站">
      <a href={PANDAAI_SITE} target="_blank" rel="noopener noreferrer">
        <span><b>PandaAI 官网</b><small>pandaaiquant.com</small></span><ArrowSquareOut/>
      </a>
      <a href={QUANTSKILLS_SITE} target="_blank" rel="noopener noreferrer">
        <span><b>QuantSkills 官网</b><small>quantskills.ai</small></span><ArrowSquareOut/>
      </a>
    </nav>
    <section className={css.brandHomeCommunity} aria-label="社区与支持">
      <article>
        <img src={pandaGroupAssistantQr} alt="PandaAI 入群小助理二维码"/>
        <span><ChatsCircle/><b>入群小助理</b><small>安装协助与用户群</small></span>
      </article>
      <article>
        <img src={quantSkillsWechatQr} alt="QuantSkills 官方公众号二维码"/>
        <span><Broadcast/><b>官方公众号</b><small>产品更新与研究内容</small></span>
      </article>
    </section>
  </aside>
}
