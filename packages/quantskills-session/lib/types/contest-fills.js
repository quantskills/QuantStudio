import { z } from 'zod';
import { record } from "./contest-cli.js";
import { contestContractParts } from "./contest-contract.js";
export const contestFillSchema = z.object({ id: z.string().min(1).max(200), tradeId: z.string().min(1).max(200), orderId: z.string().min(1).max(200),
    price: z.number().finite().positive(), volume: z.number().int().positive(), time: z.string().min(1).max(80) });
export function planOrderId(plan) {
    if (plan.operation !== 'place_order' || ['prepared', 'cancelled'].includes(plan.status))
        return undefined;
    const result = plan.result ?? {};
    const ids = [record(result.latestOrder).orderId, record(result.result).orderId].filter((id) => typeof id === 'string' && id.length > 0);
    return ids.length && new Set(ids).size === 1 ? ids[0] : undefined;
}
/** Only trade records joined to the bound order can supply execution prices. */
export function mergePlanFills(plan, rows) {
    const orderId = planOrderId(plan), parameters = record(plan.details.parameters);
    if (!orderId || !Array.isArray(rows) || typeof parameters.contractCode !== 'string')
        return false;
    const contract = contestContractParts;
    const planned = contract(parameters.contractCode), receipt = record(plan.result?.latestOrder ?? plan.result?.result);
    const expected = contract(receipt.contractCode) ?? planned;
    if (!planned || !expected || planned[1].toLowerCase() !== expected[1].toLowerCase())
        return false;
    const merged = new Map((plan.fills ?? []).map(fill => [fill.id, fill]));
    for (const value of rows) {
        const row = record(value), actual = contract(row.contractCode);
        if (row.orderId !== orderId || !actual || actual[1].toLowerCase() !== expected[1].toLowerCase()
            || (row.accountId !== undefined && row.accountId !== plan.identity.accountId) || (row.contestId !== undefined && row.contestId !== plan.identity.contestId)
            || (expected[2] && actual[2] && expected[2].toUpperCase() !== actual[2].toUpperCase())
            || row.side !== parameters.side || row.offset !== parameters.offset)
            continue;
        const parsed = contestFillSchema.safeParse({ id: row.id, tradeId: row.tradeId, orderId, price: row.price, volume: row.volume, time: row.tradeTime });
        if (!parsed.success)
            continue;
        const fill = parsed.data, timestamp = Date.parse(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(fill.time) ? fill.time.replace(' ', 'T') + '+08:00' : fill.time);
        if (!Number.isFinite(timestamp) || timestamp < plan.createdAt - 5000 || timestamp > Date.now() + 5000)
            continue;
        const prior = merged.get(fill.id);
        if (prior && JSON.stringify(prior) !== JSON.stringify(fill))
            return false;
        merged.set(fill.id, fill);
    }
    const fills = [...merged.values()], volume = fills.reduce((sum, fill) => sum + fill.volume, 0);
    if (!volume || typeof parameters.volume !== 'number' || volume > parameters.volume || fills.length === (plan.fills?.length ?? 0))
        return false;
    plan.fills = fills;
    return true;
}
//# sourceMappingURL=contest-fills.js.map