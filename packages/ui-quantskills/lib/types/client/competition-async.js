import { useCallback, useEffect, useRef, useState } from 'react';
/** Bound UI waiting without replaying the underlying operation. A timeout is not a server cancellation. */
export function waitForCompetition(work, label, timeout = 30_000, signal) {
    return new Promise((resolve, reject) => {
        const controller = new AbortController();
        let settled = false;
        const finish = (complete) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            signal?.removeEventListener('abort', abort);
            complete();
        };
        const abort = () => finish(() => { controller.abort(); reject(new Error('已停止等待此页面的请求。')); });
        const timer = setTimeout(() => finish(() => { controller.abort(); reject(new Error(`${label}响应超时，请检查连接后刷新状态。`)); }), timeout);
        if (signal?.aborted) {
            abort();
            return;
        }
        signal?.addEventListener('abort', abort, { once: true });
        try {
            work(controller.signal).then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
        }
        catch (error) {
            finish(() => reject(error));
        }
    });
}
/** Shared only by the two competition surfaces; no ordinary-session polling or global state. */
export function useCompetitionState(access, sessionId) {
    const [status, setStatus] = useState(), [readError, setReadError] = useState(''), [actionError, setActionError] = useState(''), [busy, setBusy] = useState('');
    const mounted = useRef(false), revision = useRef(0), lifetime = useRef(new AbortController());
    const reading = useRef(undefined);
    const active = useRef(undefined);
    const refresh = useCallback(() => {
        if (!mounted.current)
            return Promise.resolve();
        const version = revision.current;
        if (reading.current?.revision === version)
            return reading.current.promise;
        const promise = waitForCompetition(() => access.status(sessionId), '比赛状态读取', 15_000, lifetime.current.signal).then(next => {
            if (mounted.current && version === revision.current) {
                setStatus(next);
                setReadError('');
            }
        }).catch(error => {
            if (mounted.current && version === revision.current)
                setReadError(error instanceof Error ? error.message : '无法读取比赛状态。');
        }).finally(() => { if (reading.current?.promise === promise)
            reading.current = undefined; });
        reading.current = { revision: version, promise };
        return promise;
    }, [access, sessionId]);
    useEffect(() => {
        mounted.current = true;
        lifetime.current = new AbortController();
        revision.current++;
        active.current = undefined;
        reading.current = undefined;
        setStatus(undefined);
        setBusy('');
        setReadError('');
        setActionError('');
        let stopped = false, timer;
        const poll = async () => {
            await refresh();
            if (!stopped)
                timer = setTimeout(() => { void poll(); }, 2000);
        };
        const focus = () => { if (document.visibilityState !== 'hidden')
            void refresh(); };
        void poll();
        window.addEventListener('focus', focus);
        document.addEventListener('visibilitychange', focus);
        return () => {
            stopped = true;
            mounted.current = false;
            revision.current++;
            clearTimeout(timer);
            lifetime.current.abort();
            active.current?.controller.abort();
            active.current = undefined;
            reading.current = undefined;
            window.removeEventListener('focus', focus);
            document.removeEventListener('visibilitychange', focus);
        };
    }, [refresh]);
    const run = async (name, work) => {
        if (!mounted.current || (active.current && (active.current.name === name || (name !== 'mode' && name !== 'stop'))))
            return false;
        active.current?.controller.abort();
        const action = { name, controller: new AbortController() };
        active.current = action;
        revision.current++;
        setBusy(name);
        setActionError('');
        let receivedStatus = false;
        try {
            const next = await waitForCompetition(work, '比赛操作', ['connect', 'login', 'update'].includes(name) ? 600_000 : 60_000, action.controller.signal);
            if (!mounted.current || active.current !== action)
                return false;
            revision.current++;
            if (next && typeof next === 'object' && 'enabled' in next && typeof next.enabled === 'boolean'
                && 'phase' in next && typeof next.phase === 'string' && 'plans' in next && Array.isArray(next.plans)) {
                setStatus(next);
                setReadError('');
                receivedStatus = true;
            }
            return true;
        }
        catch (error) {
            if (mounted.current && active.current === action)
                setActionError(error instanceof Error ? error.message : '比赛操作未完成。');
            return false;
        }
        finally {
            if (mounted.current && active.current === action) {
                active.current = undefined;
                setBusy('');
                // A completed action or dialog must never wait for a second network round trip.
                if (!receivedStatus)
                    void refresh();
            }
        }
    };
    return { status, error: actionError || readError, busy, run, refresh };
}
//# sourceMappingURL=competition-async.js.map