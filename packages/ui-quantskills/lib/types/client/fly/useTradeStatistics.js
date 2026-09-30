import { useEffect, useState } from 'react';
import { flyFetch } from "./transport.js";
// Reads the local receipt ledger, without querying the competition counter.
export function useTradeStatistics(day = '') {
    const [data, setData] = useState();
    const [error, setError] = useState('');
    useEffect(() => {
        setData(undefined);
        let stopped = false;
        let timer;
        const controller = new AbortController();
        const refresh = async () => {
            try {
                const response = await flyFetch(`/api/fly/v2/statistics${day ? `?day=${day.replaceAll('-', '')}` : ''}`, { signal: controller.signal });
                if (!response.ok)
                    throw new Error('统计暂未刷新，等待服务恢复');
                const result = await response.json();
                if (!Array.isArray(result.rows) || !Array.isArray(result.fills) || !result.summary)
                    throw new Error('统计暂不可用');
                if (!stopped) {
                    setData(result);
                    setError('');
                }
            }
            catch (e) {
                if (!stopped)
                    setError(e instanceof Error ? e.message : '统计暂不可用');
            }
            if (!stopped)
                timer = setTimeout(() => void refresh(), 5000);
        };
        void refresh();
        return () => { stopped = true; clearTimeout(timer); controller.abort(); };
    }, [day]);
    return { data, error };
}
//# sourceMappingURL=useTradeStatistics.js.map