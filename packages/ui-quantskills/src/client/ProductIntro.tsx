import { useEffect, useId, useRef } from 'react'
import { ArrowUpRightIcon, ArrowRightIcon } from '@phosphor-icons/react'
import { ZoomableImage } from './ZoomableImage.tsx'
import qubeInterface from './assets/qube-interface.webp'
import evoInterface from './assets/evo-interface.webp'
import pandaMark from './assets/pandaai-mark.png'
import css from './ProductIntro.module.css'

type Product = 'qube' | 'evo'
export const PRODUCT_URLS = { qube: 'https://www.pandaaiquant.com/agent_quant/', evo: 'https://www.pandaaiquant.com/evo/' } as const
const PRODUCTS = {
  qube: {
    name: 'QUBE', label: '策略生产与验证工作台', title: '把交易想法，变成可验证的策略。',
    description: '描述你的交易逻辑，生成策略代码，运行真实回测，再根据结果继续调整。适合目标明确、需要快速验证的量化任务。',
    image: qubeInterface, caption: '对话式策略入口', article: 'https://www.pandaaiquant.com/blog/qube-release',
    features: [
      ['策略开发', '自然语言生成策略与代码，衔接回测和参数调整。'],
      ['真实验证', '查看收益曲线、交易明细与日志，用运行结果检验想法。'],
      ['继续优化', '在已有结果上分析因子、寻找参数，并进行仿真验证。'],
      ['留下结果', '保留策略版本、运行历史与参数记录，继续上一次研究。'],
    ],
    audience: '有想法，需要尽快验证。', audienceText: '适合交易员、业务研究人员，以及希望通过自然语言快速试验策略的用户。',
    example: '把一个交易想法写成策略，比较参数变化，并检查回测中的交易记录。',
  },
  evo: {
    name: 'EVO', label: '金融研究操作系统', title: '把研究过程，变成可积累的能力。',
    description: '把研报、因子、文件、环境与 AI 能力放进独立研究空间。围绕复杂问题持续实验、协作和迭代，保留完整研究轨迹。',
    image: evoInterface, caption: '云端研究工作区', article: 'https://mp.weixin.qq.com/s/PlgZTEyB1OfODCCl_dHqLQ',
    features: [
      ['材料理解', '整理研报与研究文件，把问题、证据和参考材料放在一起。'],
      ['因子研究', '探索因子构建、稳健性与关系分析，承接更长的研究链路。'],
      ['能力编排', '结合 Skills、Agents 与 Tools，组织和执行多步骤研究任务。'],
      ['资产沉淀', '留存实验结果、迭代关系与团队文档，形成可复用的工作方法。'],
    ],
    audience: '问题更复杂，需要持续研究。', audienceText: '适合量化研究员、因子开发者、策略开发者，以及需要沉淀方法与资产的研究团队。',
    example: '从研报中提取因子思路，管理实验文件，完成多轮验证并保存研究过程。',
  },
} as const
const COMPARISON = [
  ['核心目标', '快速把想法变成结果', '把研究过程变成能力'],
  ['功能范围', '策略生成、回测、参数寻优与仿真验证', '研报理解、因子研究、文件与环境管理'],
  ['AI 能力', '面向策略任务，调用模型与工具', '组合 Skills、Agents、Tools，推进复杂研究'],
  ['适用场景', '标准化任务、交易想法的快速验证', '长期、多文件、自定义的深度研究'],
  ['适合人群', '想法验证者、交易员与业务用户', '专业研究者、策略开发者与研究团队'],
  ['资产沉淀', '策略版本、运行历史与参数结果', '实验轨迹、研究文档与可复用工作流'],
] as const
function ExternalLink({ href, children, primary = false }: { href: string; children: string; primary?: boolean }) {
  return <a className={primary ? css.start : css.textLink} href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRightIcon size={17} aria-hidden="true"/></a>
}
export function ProductIntro({ product, navigate }: { product: Product; navigate: (product: Product) => void }) {
  const data = PRODUCTS[product], other = product === 'qube' ? 'evo' : 'qube', comparisonId = useId()
  const pageRef = useRef<HTMLElement>(null)
  useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }) }, [product])
  return <section ref={pageRef} className={css.page} data-product={product} aria-label={`${data.name} 产品介绍`}>
    <nav className={css.productNav} aria-label="产品介绍切换">
      <span className={css.brand}><img src={pandaMark} alt=""/>PandaAI <small>产品</small></span>
      <div>{(['qube', 'evo'] as const).map(id => <button type="button" key={id} aria-current={product === id ? 'page' : undefined} onClick={() => navigate(id)}>{PRODUCTS[id].name}</button>)}</div>
    </nav>
    <header className={css.hero}>
      <div className={css.copy}><p className={css.eyebrow}>{data.label}</p><h1>{data.name}</h1><h2>{data.title}</h2><p className={css.description}>{data.description}</p>
        <div className={css.actions}><ExternalLink href={PRODUCT_URLS[product]} primary>开始体验</ExternalLink><ExternalLink href={data.article}>产品介绍</ExternalLink></div>
      </div>
      <figure className={css.interface}><ZoomableImage src={data.image} alt={`${data.name} ${data.caption}真实界面`} width={2550} height={1293}/><figcaption><span><b>{data.name}</b> {data.caption}</span><small>双击放大</small></figcaption></figure>
    </header>
    <section className={css.work} aria-label={`${data.name} 主要功能`}>
      <div className={css.sectionHeading}><small>01 / 工作方式</small><h2>{product === 'qube' ? '从策略想法到运行结果' : '从研究材料到完整实验'}</h2><a href={`#${comparisonId}`} className={css.textLink}>与 {PRODUCTS[other].name} 对比 <ArrowRightIcon size={16}/></a></div>
      <dl className={css.features}>{data.features.map(([title, text], i) => <div key={title}><dt><span>0{i + 1}</span>{title}</dt><dd>{text}</dd></div>)}</dl>
    </section>
    <section className={css.audience}><div><small>02 / 适合谁</small><h2>{data.audience}</h2><p>{data.audienceText}</p></div><blockquote><small>可以从这件事开始</small><p>{data.example}</p></blockquote></section>
    <section id={comparisonId} className={css.comparison} aria-label="QUBE 与 EVO 功能对比">
      <div className={css.sectionHeading}><small>03 / 产品对比</small><h2>一个负责快速验证，一个负责深度研究。</h2></div>
      <div className={css.tableWrap}><table><caption>六个维度，选择适合你的工作方式</caption><thead><tr><th scope="col">对比维度</th><th scope="col">QUBE</th><th scope="col">EVO</th></tr></thead><tbody>{COMPARISON.map(([label, q, e]) => <tr key={label}><th scope="row">{label}</th><td>{q}</td><td>{e}</td></tr>)}</tbody></table></div>
    </section>
    <section className={css.foundation}><small>PANDAAI / 共同底座</small><h2>金融研究需要的基础能力</h2><ul>{[['模型', '多模型与垂类模型'], ['数据', '金融数据与 MCP'], ['算力', '弹性算力与资源计量'], ['安全', '权限与安全隔离'], ['审计', '过程追踪与审计']].map(([title, text]) => <li key={title}><b>{title}</b><span>{text}</span></li>)}</ul></section>
    <footer className={css.footer}><div><h2>从你的下一项任务开始。</h2><p>QUBE 提升策略验证效率，EVO 承接深度研究。按任务选择，也可以配合使用。</p><div className={css.actions}><ExternalLink href={PRODUCT_URLS[product]} primary>开始体验</ExternalLink><button type="button" className={css.textLink} onClick={() => navigate(other)}>了解 {PRODUCTS[other].name}<ArrowRightIcon size={17}/></button></div></div><ExternalLink href="https://www.pandaaiquant.com/blog">PandaAI 量化博客</ExternalLink></footer>
  </section>
}
