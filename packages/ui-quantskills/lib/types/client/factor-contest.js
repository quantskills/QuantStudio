import { useCompetitionState } from "./competition-async.js";
export const factorPhases = { off: '已关闭', disconnected: '未连接', installing: '正在准备 CLI', connected: '已连接', error: '需要处理' };
export const factorStates = { prepared: '待确认', executing: '正在提交', completed: '已完成', failed: '未完成', unknown: '待核实 · 勿重发',
    cancelled: '已取消', expired: '已过期', active: '已授权', stopped: '已停止', exhausted: '已到预算限制', creating: '正在创建', running: '回测中' };
/** Local polling only. Invalidates late reads and actions on session changes or mode changes. */
export function useFactorContest(access, sessionId) {
    return useCompetitionState(access, sessionId);
}
//# sourceMappingURL=factor-contest.js.map