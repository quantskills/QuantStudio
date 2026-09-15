import { useCallback, useEffect, useRef, useState } from 'react';
export const factorPhases = { off: '已关闭', disconnected: '未连接', installing: '正在准备 CLI', connected: '已连接', error: '需要处理' };
export const factorStates = { prepared: '待确认', executing: '正在提交', completed: '已完成', failed: '未完成', unknown: '待核实 · 勿重发',
    cancelled: '已取消', expired: '已过期', active: '已授权', stopped: '已停止', exhausted: '已到预算限制', creating: '正在创建', running: '回测中' };
/** Local polling only. Invalidates late reads and actions on session changes or mode changes. */
export function useFactorContest(access, sessionId) {
    const [status, setStatus] = useState(), [error, setError] = useState(''), [busy, setBusy] = useState('');
    const mounted = useRef(false), reads = useRef(0), actions = useRef(0), active = useRef('');
    const refresh = useCallback(async () => {
        const serial = ++reads.current;
        try {
            const next = await access.status(sessionId);
            if (mounted.current && serial === reads.current)
                setStatus(next);
        }
        catch (e) {
            if (mounted.current && serial === reads.current)
                setError(e instanceof Error ? e.message : '无法读取因子比赛状态。');
        }
    }, [access, sessionId]);
    useEffect(() => {
        mounted.current = true;
        setStatus(undefined);
        setError('');
        void refresh();
        const timer = window.setInterval(() => { void refresh(); }, 2000);
        return () => { mounted.current = false; reads.current++; actions.current++; window.clearInterval(timer); };
    }, [refresh]);
    const run = async (name, work) => {
        if (active.current && name !== 'mode' && name !== 'stop')
            return false;
        const serial = ++actions.current;
        active.current = name;
        setBusy(name);
        setError('');
        reads.current++;
        try {
            await work();
            return mounted.current && serial === actions.current;
        }
        catch (e) {
            if (mounted.current && serial === actions.current)
                setError(e instanceof Error ? e.message : '因子操作未完成。');
            return false;
        }
        finally {
            if (mounted.current && serial === actions.current) {
                active.current = '';
                setBusy('');
                await refresh();
            }
        }
    };
    return { status, error, busy, run, refresh };
}
//# sourceMappingURL=factor-contest.js.map