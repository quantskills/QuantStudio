import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useId, useRef } from 'react';
import { ArrowUpRightIcon, ArrowRightIcon } from '@phosphor-icons/react';
import { ZoomableImage } from "./ZoomableImage.js";
import qubeInterface from './assets/qube-interface.webp';
import evoInterface from './assets/evo-interface.webp';
import pandaMark from './assets/pandaai-mark.png';
import css from './ProductIntro.module.css';
export const PRODUCT_URLS = { qube: 'https://www.pandaaiquant.com/agent_quant/', evo: 'https://www.pandaaiquant.com/evo/' };
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
};
const COMPARISON = [
    ['核心目标', '快速把想法变成结果', '把研究过程变成能力'],
    ['功能范围', '策略生成、回测、参数寻优与仿真验证', '研报理解、因子研究、文件与环境管理'],
    ['AI 能力', '面向策略任务，调用模型与工具', '组合 Skills、Agents、Tools，推进复杂研究'],
    ['适用场景', '标准化任务、交易想法的快速验证', '长期、多文件、自定义的深度研究'],
    ['适合人群', '想法验证者、交易员与业务用户', '专业研究者、策略开发者与研究团队'],
    ['资产沉淀', '策略版本、运行历史与参数结果', '实验轨迹、研究文档与可复用工作流'],
];
function ExternalLink({ href, children, primary = false }) {
    return _jsxs("a", { className: primary ? css.start : css.textLink, href: href, target: "_blank", rel: "noopener noreferrer", children: [children, _jsx(ArrowUpRightIcon, { size: 17, "aria-hidden": "true" })] });
}
export function ProductIntro({ product, navigate }) {
    const data = PRODUCTS[product], other = product === 'qube' ? 'evo' : 'qube', comparisonId = useId();
    const pageRef = useRef(null);
    useEffect(() => { pageRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }, [product]);
    return _jsxs("section", { ref: pageRef, className: css.page, "data-product": product, "aria-label": `${data.name} 产品介绍`, children: [_jsxs("nav", { className: css.productNav, "aria-label": "\u4EA7\u54C1\u4ECB\u7ECD\u5207\u6362", children: [_jsxs("span", { className: css.brand, children: [_jsx("img", { src: pandaMark, alt: "" }), "PandaAI ", _jsx("small", { children: "\u4EA7\u54C1" })] }), _jsx("div", { children: ['qube', 'evo'].map(id => _jsx("button", { type: "button", "aria-current": product === id ? 'page' : undefined, onClick: () => navigate(id), children: PRODUCTS[id].name }, id)) })] }), _jsxs("header", { className: css.hero, children: [_jsxs("div", { className: css.copy, children: [_jsx("p", { className: css.eyebrow, children: data.label }), _jsx("h1", { children: data.name }), _jsx("h2", { children: data.title }), _jsx("p", { className: css.description, children: data.description }), _jsxs("div", { className: css.actions, children: [_jsx(ExternalLink, { href: PRODUCT_URLS[product], primary: true, children: "\u5F00\u59CB\u4F53\u9A8C" }), _jsx(ExternalLink, { href: data.article, children: "\u4EA7\u54C1\u4ECB\u7ECD" })] })] }), _jsxs("figure", { className: css.interface, children: [_jsx(ZoomableImage, { src: data.image, alt: `${data.name} ${data.caption}真实界面`, width: 2550, height: 1293 }), _jsxs("figcaption", { children: [_jsxs("span", { children: [_jsx("b", { children: data.name }), " ", data.caption] }), _jsx("small", { children: "\u53CC\u51FB\u653E\u5927" })] })] })] }), _jsxs("section", { className: css.work, "aria-label": `${data.name} 主要功能`, children: [_jsxs("div", { className: css.sectionHeading, children: [_jsx("small", { children: "01 / \u5DE5\u4F5C\u65B9\u5F0F" }), _jsx("h2", { children: product === 'qube' ? '从策略想法到运行结果' : '从研究材料到完整实验' }), _jsxs("a", { href: `#${comparisonId}`, className: css.textLink, children: ["\u4E0E ", PRODUCTS[other].name, " \u5BF9\u6BD4 ", _jsx(ArrowRightIcon, { size: 16 })] })] }), _jsx("dl", { className: css.features, children: data.features.map(([title, text], i) => _jsxs("div", { children: [_jsxs("dt", { children: [_jsxs("span", { children: ["0", i + 1] }), title] }), _jsx("dd", { children: text })] }, title)) })] }), _jsxs("section", { className: css.audience, children: [_jsxs("div", { children: [_jsx("small", { children: "02 / \u9002\u5408\u8C01" }), _jsx("h2", { children: data.audience }), _jsx("p", { children: data.audienceText })] }), _jsxs("blockquote", { children: [_jsx("small", { children: "\u53EF\u4EE5\u4ECE\u8FD9\u4EF6\u4E8B\u5F00\u59CB" }), _jsx("p", { children: data.example })] })] }), _jsxs("section", { id: comparisonId, className: css.comparison, "aria-label": "QUBE \u4E0E EVO \u529F\u80FD\u5BF9\u6BD4", children: [_jsxs("div", { className: css.sectionHeading, children: [_jsx("small", { children: "03 / \u4EA7\u54C1\u5BF9\u6BD4" }), _jsx("h2", { children: "\u4E00\u4E2A\u8D1F\u8D23\u5FEB\u901F\u9A8C\u8BC1\uFF0C\u4E00\u4E2A\u8D1F\u8D23\u6DF1\u5EA6\u7814\u7A76\u3002" })] }), _jsx("div", { className: css.tableWrap, children: _jsxs("table", { children: [_jsx("caption", { children: "\u516D\u4E2A\u7EF4\u5EA6\uFF0C\u9009\u62E9\u9002\u5408\u4F60\u7684\u5DE5\u4F5C\u65B9\u5F0F" }), _jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { scope: "col", children: "\u5BF9\u6BD4\u7EF4\u5EA6" }), _jsx("th", { scope: "col", children: "QUBE" }), _jsx("th", { scope: "col", children: "EVO" })] }) }), _jsx("tbody", { children: COMPARISON.map(([label, q, e]) => _jsxs("tr", { children: [_jsx("th", { scope: "row", children: label }), _jsx("td", { children: q }), _jsx("td", { children: e })] }, label)) })] }) })] }), _jsxs("section", { className: css.foundation, children: [_jsx("small", { children: "PANDAAI / \u5171\u540C\u5E95\u5EA7" }), _jsx("h2", { children: "\u91D1\u878D\u7814\u7A76\u9700\u8981\u7684\u57FA\u7840\u80FD\u529B" }), _jsx("ul", { children: [['模型', '多模型与垂类模型'], ['数据', '金融数据与 MCP'], ['算力', '弹性算力与资源计量'], ['安全', '权限与安全隔离'], ['审计', '过程追踪与审计']].map(([title, text]) => _jsxs("li", { children: [_jsx("b", { children: title }), _jsx("span", { children: text })] }, title)) })] }), _jsxs("footer", { className: css.footer, children: [_jsxs("div", { children: [_jsx("h2", { children: "\u4ECE\u4F60\u7684\u4E0B\u4E00\u9879\u4EFB\u52A1\u5F00\u59CB\u3002" }), _jsx("p", { children: "QUBE \u63D0\u5347\u7B56\u7565\u9A8C\u8BC1\u6548\u7387\uFF0CEVO \u627F\u63A5\u6DF1\u5EA6\u7814\u7A76\u3002\u6309\u4EFB\u52A1\u9009\u62E9\uFF0C\u4E5F\u53EF\u4EE5\u914D\u5408\u4F7F\u7528\u3002" }), _jsxs("div", { className: css.actions, children: [_jsx(ExternalLink, { href: PRODUCT_URLS[product], primary: true, children: "\u5F00\u59CB\u4F53\u9A8C" }), _jsxs("button", { type: "button", className: css.textLink, onClick: () => navigate(other), children: ["\u4E86\u89E3 ", PRODUCTS[other].name, _jsx(ArrowRightIcon, { size: 17 })] })] })] }), _jsx(ExternalLink, { href: "https://www.pandaaiquant.com/blog", children: "PandaAI \u91CF\u5316\u535A\u5BA2" })] })] });
}
//# sourceMappingURL=ProductIntro.js.map