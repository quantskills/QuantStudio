import type {
  HeroBrandMarkOwnerProps, HeroIdentityOwnerProps,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ConversationLabelOwnerProps } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import { createQuantSkillsViewStore } from './store.ts'
import markUrl from './assets/quantskills-mark.png'
import lockupUrl from './assets/quantskills-lockup.png'
import pandaMarkUrl from './assets/pandaai-mark.png'
import { useEffect, useState } from 'react'
import researchMarkLight from './assets/research-mark-light.webp'
import researchMarkDark from './assets/research-mark-dark.webp'
import css from './QuantSkillsApp.module.css'

const QUANTSKILLS_MANIFEST = Object.freeze({
  id: '/',
  name: 'QuantSkills',
  short_name: 'QuantSkills',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  icons: [{ src: markUrl, sizes: 'any', type: 'image/png', purpose: 'any' }],
})

type QuantSkillsBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps
type ViewStore = ReturnType<typeof createQuantSkillsViewStore>
type ViewInstance = ReturnType<ViewStore['create']>

/** State supplied to conversation branding registered by the QuantSkills application. */
export interface QuantSkillsConversationBrandInjected {
  /** Standalone always owns its conversation; native-plugin owns it only while its conversation view is open. */
  mode: 'standalone' | 'native-plugin'
  hooks: { view: ViewInstance['store'] }
}

type QuantSkillsConversationHeroIdentityProps = HeroIdentityOwnerProps
  & InjectFace<QuantSkillsConversationBrandInjected>
type QuantSkillsConversationStatusProps = ConversationLabelOwnerProps
  & InjectFace<QuantSkillsConversationBrandInjected>

/** Whether the visible conversation belongs to QuantSkills. */
function useQuantSkillsConversation(
  mode: QuantSkillsConversationBrandInjected['mode'],
  useView: QuantSkillsConversationHeroIdentityProps['useView'],
): boolean {
  const pluginConversationOpen = useView(state => state.pluginOpen && state.pluginConversationOpen)
  return mode === 'standalone' || pluginConversationOpen
}

/**
 * Replace the stock DSH document icon and application manifest for this client lifetime.
 * @returns A disposer that restores the Host document metadata.
 */
export function installQuantSkillsDocumentBrand(): () => void {
  const displaced = [...document.head.querySelectorAll<HTMLLinkElement>(
    'link[rel~="icon"], link[rel="manifest"], link[rel="apple-touch-icon"]',
  )]
  for (const link of displaced) link.remove()

  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.type = 'image/png'
  icon.href = markUrl

  const touchIcon = document.createElement('link')
  touchIcon.rel = 'apple-touch-icon'
  touchIcon.href = markUrl

  const manifest = document.createElement('link')
  manifest.rel = 'manifest'
  const source = JSON.stringify(QUANTSKILLS_MANIFEST)
  const objectUrl = typeof URL.createObjectURL === 'function'
    ? URL.createObjectURL(new Blob([source], { type: 'application/manifest+json' }))
    : undefined
  manifest.href = objectUrl ?? `data:application/manifest+json,${encodeURIComponent(source)}`

  const title = document.querySelector('title')
  const updateTitle = () => {
    const next = document.title.replace(/DSH 本地构建|DeepSeek Harness|DeepSeekHarness|DeepSeek\s*Harness/gi, 'QuantSkills')
    if (next !== document.title) document.title = next
  }
  const titleObserver = new MutationObserver(updateTitle)
  if (title) titleObserver.observe(title, { childList: true, subtree: true, characterData: true })
  updateTitle()
  document.head.append(icon, touchIcon, manifest)
  return () => {
    titleObserver.disconnect()
    icon.remove()
    touchIcon.remove()
    manifest.remove()
    if (objectUrl !== undefined) URL.revokeObjectURL(objectUrl)
    document.head.append(...displaced)
  }
}

/**
 * Render the compact QuantSkills mark at the size requested by its host surface.
 * @param props - Host-supplied square size and optional presentation class.
 * @returns The QuantSkills mark image.
 */
export function QuantSkillsBrandMark({ size, className }: QuantSkillsBrandMarkProps) {
  return <img
    src={markUrl}
    className={`${css.brandAsset} ${css.brandMark}${className === undefined ? '' : ` ${className}`}`}
    style={{ width: size, height: size }}
    alt=""
    aria-hidden="true"
  />
}

/**
 * Replace the native empty-session identity only while QuantSkills owns the conversation.
 * @param props - Native fallback presentation plus QuantSkills view state.
 * @returns The native or QuantSkills identity in the host's layout.
 */
export function QuantSkillsConversationHeroIdentity({
  mode, useView, defaultMark, defaultHeadline, size, className, renderIdentity,
}: QuantSkillsConversationHeroIdentityProps) {
  if (!useQuantSkillsConversation(mode, useView)) {
    return <>{renderIdentity(defaultMark, defaultHeadline)}</>
  }
  return <>{renderIdentity(
    <QuantSkillsBrandMark size={size} className={className} />,
    'QuantSkills 量化研究工作台',
  )}</>
}

/**
 * Replace the generic live-turn label only while QuantSkills owns the conversation.
 * @param props - Native fallback label plus QuantSkills view state.
 * @returns The native or QuantSkills activity label.
 */
export function QuantSkillsConversationStatus({
  mode, useView, defaultLabel,
}: QuantSkillsConversationStatusProps) {
  if (!useQuantSkillsConversation(mode, useView)) return <>{defaultLabel}</>
  return <QuantSkillsResearchStatus/>
}

const RESEARCH_PHRASES = [
  '正在深入研究…',
  '给灵感一点加速度…',
  '让线索慢慢连成星图…',
  '正在把问题拆成小拼图…',
  '好想法，值得多想一会儿…',
  '为你的问题多转几个弯…',
] as const

function QuantSkillsResearchStatus() {
  const [phrase, setPhrase] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhrase(current => (current + 1) % RESEARCH_PHRASES.length)
    }, 5_000)
    return () => { window.clearInterval(timer) }
  }, [])
  return <span className={css.researchStatus} role="status" aria-label="QuantSkills 正在分析，请稍候">
    <span className={css.researchStatusMark} aria-hidden="true">
      <img src={researchMarkLight} className={css.researchStatusMarkLight} alt=""/>
      <img src={researchMarkDark} className={css.researchStatusMarkDark} alt=""/>
      <img src={markUrl} className={css.researchStatusStatic} alt=""/>
    </span>
    <span className={css.researchPhrase} key={phrase} aria-hidden="true">{RESEARCH_PHRASES[phrase]}</span>
  </span>
}

/**
 * Render the endorsed QuantSkills lockup where width permits.
 * @returns The QuantSkills lockup with its PandaAI endorsement.
 */
export function QuantSkillsBrandLockup() {
  return <span className={css.brandEndorsedLockup} role="img" aria-label="QuantSkills by PandaAI">
    <img src={lockupUrl} className={`${css.brandAsset} ${css.brandLockup}`} alt="" aria-hidden="true" />
    <i className={css.brandDivider} aria-hidden="true" />
    <span className={css.brandEndorsement} aria-hidden="true">
      <small>by</small>
      <img src={pandaMarkUrl} className={`${css.brandAsset} ${css.pandaBrandMark}`} alt="" />
      <b>PandaAI</b>
    </span>
  </span>
}
