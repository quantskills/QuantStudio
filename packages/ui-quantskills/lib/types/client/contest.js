import { useCallback, useEffect, useRef, useState } from 'react';
/** Polls local status only while a contest surface is mounted. Late responses cannot restore old UI state. */
export function useContest(access, sessionId) {
    const [status, setStatus] = useState();
    const [error, setError] = useState();
    const [busy, setBusy] = useState('');
    const reads = useRef(0), action = useRef(0), mounted = useRef(true), active = useRef('');
    const watched = useRef(new Map()), watching = useRef(new Set());
    const refresh = useCallback(async () => {
        const request = ++reads.current;
        try {
            const next = await access.status(sessionId);
            if (mounted.current && request === reads.current)
                setStatus(next);
        }
        catch (error) {
            if (mounted.current && request === reads.current)
                setError(error instanceof Error ? error.message : '无法读取比赛状态。');
        }
    }, [access, sessionId]);
    useEffect(() => {
        mounted.current = true;
        setStatus(undefined);
        void refresh();
        const timer = window.setInterval(() => { void refresh(); }, 2000);
        return () => { mounted.current = false; reads.current++; window.clearInterval(timer); };
    }, [refresh]);
    useEffect(() => {
        if (!status?.enabled || status.phase !== 'connected')
            return;
        // Bounded read-only follow-up. Unknown/partial/terminal outcomes always stop automatic polling.
        for (const plan of status.plans) {
            if (!['queued', 'submitted'].includes(plan.status) || watching.current.has(plan.id) || (watched.current.get(plan.id) ?? 0) >= 10)
                continue;
            watching.current.add(plan.id);
            watched.current.set(plan.id, (watched.current.get(plan.id) ?? 0) + 1);
            void access.reconcile(plan).catch(error => {
                if (mounted.current)
                    setError(error instanceof Error ? error.message : '无法查询交易回执，请稍后手动查询。');
                watched.current.set(plan.id, 10);
            }).finally(() => { watching.current.delete(plan.id); });
        }
    }, [status, access]);
    const run = async (name, work) => {
        if (active.current && name !== 'mode')
            return;
        const id = ++action.current;
        active.current = name;
        setBusy(name);
        setError(undefined);
        reads.current++;
        try {
            await work();
        }
        catch (error) {
            if (mounted.current && id === action.current)
                setError(error instanceof Error ? error.message : '比赛操作未完成。');
        }
        finally {
            if (mounted.current && id === action.current) {
                active.current = '';
                setBusy('');
                await refresh();
            }
        }
    };
    return { status, error, busy, run, refresh };
}
export const contestPhases = { off: '已关闭', disconnected: '未连接', installing: '准备中', authenticating: '等待官网授权', connected: '已连接', error: '需要处理' };
export const planStates = {
    prepared: '待确认', executing: '正在提交', queued: '已排队 · 尚未成交', submitted: '已提交 · 等待回报',
    completed: '操作已完成 · 成交以柜台记录为准', partial: '部分完成 · 请核对委托', failed: '操作失败', expired: '已过期', unknown: '回执待核实 · 请勿重发', cancelled: '已取消计划',
};
export function asRecord(value) { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
export function display(value) {
    if (value === undefined || value === null || value === '')
        return '—';
    if (typeof value === 'number')
        return Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) : '—';
    if (typeof value === 'object')
        return JSON.stringify(value);
    return String(value);
}
export function contestTime(time) { return new Date(time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }); }
//# sourceMappingURL=contest.js.map