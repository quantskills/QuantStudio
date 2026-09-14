import { EXPERT_PRESETS, findPresetExpert, presetRequest } from "./expert-presets.js";
import { OFFICE_TEAM_PRESETS, OFFICE_DELIVERY_RULES } from "./office-presets.js";
export const TEAM_PRESETS = [
    { id: 'company-research', name: '公司深度研究团', group: 'investing', summary: '把业务、财报、行业和新闻放在一起，交叉核验一家公司。', example: '研究宁德时代：盈利质量、行业竞争和近期事件分别有哪些变化？', output: '公司深研报告、同业对比、证据与分歧清单', lead: 'stock-research', members: [
            { expert: 'financial-statements', responsibility: '核验财报版本、三表勾稽和盈利质量，交付财务对照表及异常线索。' },
            { expert: 'industry-research', responsibility: '梳理公司所在产业链、竞争格局和同业差异，交付行业与公司比较。' },
            { expert: 'news-events', responsibility: '核验近期公告与重大事件，交付含原始来源和时间的事件清单。' },
        ], stages: [
            '负责人确认证券主体、研究时点和用户重点，统一财报期、估值日、币种及可比公司口径。',
            '财报、行业、新闻三条线可独立并行；负责人同步分析业务结构，禁止成员重复拉取同一份已满足需求的缓存。',
            '负责人交叉核验事件与经营数据，针对冲突向对应成员追问；保留分歧，不用多数意见代替证据。',
            '交付主要结论、支持与反面证据、估值假设、风险及后续观察点；没有验证的事项明确列出。',
        ] },
    { id: 'daily-market', name: '每日市场研究团', group: 'investing', summary: '联合行情、新闻和行业分析，生成有来源的市场简报。', example: '做一份最近交易日的A股简报，重点关注半导体与新能源。', output: '市场简报、重点事件、行业与公司观察清单', lead: 'industry-research', members: [
            { expert: 'quant-research', responsibility: '仅负责当期行情研究：指数、成交、市场宽度和行业表现；不启动无关策略回测，交付带日期的行情摘要。' },
            { expert: 'news-events', responsibility: '核验指定窗口内的新闻和公告，去重并区分事实、传闻和观点。' },
            { expert: 'stock-research', responsibility: '核对重点公司与事件的真实业务关联，交付公司观察依据，不把热点直接当作推荐。' },
        ], stages: [
            '负责人确认市场、关注行业、时区和简报截止时间；休市日使用最近交易日行情，新闻窗口单独标注。',
            '行情与新闻并行收集，负责人整理行业背景；获得候选事件后再交公司研究成员核验业务关联。',
            '把行情变化与事件做有证据的对照，不能将同时发生直接判定为因果，也不能把缺失值当作零。',
            '输出概览、行情表、事件时间线和观察清单，每项关键事实带来源与日期；本次仅生成一份简报，不自动建立定时任务。',
        ] },
    { id: 'multi-factor-selection', name: '多因子选股团', group: 'quant', summary: '从因子检验到选股组合，再用回测和独立审查验证。', example: '用价值、质量和动量研究沪深300选股，按月调仓并做样本外验证。', output: '因子评估、候选池、组合回测、风险与审查报告', lead: 'multi-factor', members: [
            { expert: 'factor-mining', responsibility: '核验因子定义、可得时点、覆盖和冗余；记录实验及失败结果，交付因子面板和评估。' },
            { expert: 'strategy-backtest', responsibility: '接收已冻结的因子组合和交易规则，计入成本与可交易约束，生成回测及交易明细。' },
            { expert: 'holdings-diagnosis', responsibility: '接收拟研究组合的权重与历史结果，检查集中度、暴露和压力情景；不得虚构用户真实持仓。' },
            { expert: 'strategy-audit', responsibility: '独立核验历史成分、财报时点、样本划分、参数搜索和成本，交付问题证据与复验要求。' },
        ], stages: [
            '负责人冻结市场、历史股票池、样本区间、基准、调仓频率及验收标准，数据不足时先补齐或缩小研究范围。',
            '因子成员完成评估后，负责人确定合成与权重；未冻结输入前不能让回测成员自行猜测交易规则。',
            '回测完成后，风险诊断和独立审查可并行；审查发现实质问题时先修复再复验，不用测试集反复挑参数。',
            '交付带研究日期的候选池、样本外结果、成本敏感性及审查结论；不输出收益保证或自动执行交易。',
        ] },
    { id: 'strategy-development', name: '量化策略研发团', group: 'quant', summary: '从策略想法出发，完成实现、回测和独立审查。', example: '把20日突破策略实现出来，验证成本、参数稳定性和未来数据问题。', output: '研究方案、策略代码、回测明细、独立审查结论', lead: 'quant-research', members: [
            { expert: 'factor-mining', responsibility: '把信号写成可计算、可证伪定义，验证时点与稳定性；对非因子策略只研究对应信号，不擅自改成选股策略。' },
            { expert: 'strategy-backtest', responsibility: '依据负责人确认的规则实现策略与基准，输出可复现代码、交易明细及成本敏感性。' },
            { expert: 'strategy-audit', responsibility: '独立审查代码、数据和实验记录，验证泄漏、过拟合与可实现性；未拿到证据不得出具通过结论。' },
        ], stages: [
            '负责人明确假设、信号与执行时点、仓位、成本、基准和验收指标，只询问尚缺少的关键条件。',
            '先确认数据可得性并交信号成员验证定义，再交回测成员实现；负责人跟踪依赖，避免各自使用不同规则。',
            '基准实现通过后开展样本外、参数扰动和成本分析；审查成员独立复核，发现问题后回到对应阶段修复。',
            '负责人汇总有效条件、失效边界、未解决问题及复现步骤。没有实际运行的部分只能标为方案或待验证。',
        ] },
    ...OFFICE_TEAM_PRESETS,
];
export const teamPresetMarker = (preset) => `<!-- quantskills-team:${preset.id}:v1 -->`;
export const findPresetTeam = (preset, teams) => teams.find(team => team.description.includes(teamPresetMarker(preset)));
export const expertPresetById = (id) => {
    const expert = EXPERT_PRESETS.find(item => item.id === id);
    if (!expert)
        throw new Error(`找不到专家预设：${id}`);
    return expert;
};
export function teamDescription(preset) {
    if (preset.group === 'office')
        return `${preset.summary}\n\n## 目标与交付\n${preset.output}。示例：${preset.example}\n\n## 分工\n负责人：${expertPresetById(preset.lead).name}，负责接收材料、明确目标、安排依赖和核对最终交付，不包办所有成员任务。\n${preset.members.map(member => `- ${member.expert}（${expertPresetById(member.expert).name}）：${member.responsibility}`).join('\n')}\n\n## 执行顺序\n${preset.stages.map((stage, i) => `${i + 1}. ${stage}`).join('\n')}\n\n## 协作约定\n通过宿主实际提供的团队任务与消息工具调度已声明成员，不在文字中模拟协作。成员使用独立上下文；负责人传递可访问文件路径、目标、口径、交付格式和验收标准，依赖满足后再派发下一步。成员各写独立子目录，负责人统一汇总，避免覆盖。成员交付必须包含文件路径、来源定位、验证结果和未解决问题。工具或成员失败时保留完成部分并说明阻碍；不将创建团队说成工作已完成。\n\n${OFFICE_DELIVERY_RULES}\n\n${teamPresetMarker(preset)}`;
    return `${preset.summary}\n\n## 目标与交付\n${preset.output}。示例任务：${preset.example}\n\n## 分工\n负责人：${expertPresetById(preset.lead).name}。统筹口径、分派任务、跟踪依赖、交叉核验并交付最终结果。团队会话中优先履行负责人职责，不代替所有成员自行完成任务。\n${preset.members.map(member => `- ${member.expert}（${expertPresetById(member.expert).name}）：${member.responsibility}`).join('\n')}\n\n## 执行顺序\n${preset.stages.map((stage, i) => `${i + 1}. ${stage}`).join('\n')}\n\n## 协作约定\n使用当前宿主真实提供的团队任务与消息工具调度已声明成员；不要只在文字中模拟协作。成员使用独立上下文，负责人必须传递目标、数据路径、时间口径、验收标准和上游产物。依赖满足后再派发下一阶段任务。\n开始时在工作区 output 下为本次运行建立独立目录，再按成员名分子目录；成员只写自己的产物，负责人负责汇总，避免覆盖历史结果。成员交付需附文件路径、来源与日期、方法假设、关键结论和未解决事项。无法访问用户附件时由负责人传递可访问文件或内容，不虚构读取成功。\n先查本地数据目录，核验缓存状态、范围和条数；缺失再按已授权来源补齐，禁止将 insufficient 数据当作可用。负责人统一数据版本，注明财报公告时点与报告期。\n只读外部数据并在工作区保存研究文件；不执行交易、不自动发布，不建立未要求的定时安排。工具、数据或成员失败时明确报告已完成和未完成内容。单纯创建或启动会话不代表研究已完成。\n\n${teamPresetMarker(preset)}`;
}
export function teamPresetRequest(preset, definitions) {
    const resolve = (id) => {
        const expert = expertPresetById(id), saved = findPresetExpert(expert, definitions);
        if (!saved)
            throw new Error(`请先添加${expert.name}`);
        return saved;
    };
    const lead = resolve(preset.lead);
    const members = preset.members.map(member => {
        const expert = resolve(member.expert);
        if (expert.permission !== lead.permission)
            throw new Error(`${expert.name}与负责人权限不同，请先在专家配置中统一权限，再添加团队。`);
        return { name: member.expert, agentId: expert.agentId, agentRevision: expert.revision, context: 'fresh', model: { kind: 'default' } };
    });
    return { name: preset.name, description: teamDescription(preset), leadAgentId: lead.agentId, leadAgentRevision: lead.revision, leadModel: { kind: 'default' }, members };
}
/** One sequential batch reuses shared experts and preserves partial success for retry. */
export async function saveTeamPresets(presets, access) {
    const definitions = [...access.definitions], teams = [...access.teams], saved = [];
    for (const preset of presets) {
        let team = findPresetTeam(preset, teams);
        if (!team) {
            for (const id of [preset.lead, ...preset.members.map(member => member.expert)]) {
                const expert = expertPresetById(id);
                if (!findPresetExpert(expert, definitions)) {
                    const created = await access.createExpert(presetRequest(expert, access.versions));
                    definitions.push(created);
                    access.savedExpert(created);
                }
            }
            team = await access.createTeam(teamPresetRequest(preset, definitions));
            teams.push(team);
            access.savedTeam(team);
        }
        saved.push(team);
    }
    return saved;
}
//# sourceMappingURL=team-presets.js.map