import { z } from 'zod';
import type { ContestPlan } from './contest-types.ts';
export declare const contestFillSchema: z.ZodObject<{
    id: z.ZodString;
    tradeId: z.ZodString;
    orderId: z.ZodString;
    price: z.ZodNumber;
    volume: z.ZodNumber;
    time: z.ZodString;
}, z.core.$strip>;
export declare function planOrderId(plan: ContestPlan): string | undefined;
/** Only trade records joined to the bound order can supply execution prices. */
export declare function mergePlanFills(plan: ContestPlan, rows: unknown): boolean;
//# sourceMappingURL=contest-fills.d.ts.map