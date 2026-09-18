import { z } from 'zod';
import type { ContestJevRequest, ContestJevUsage } from './contest-watch-types.ts';
export declare const jevUsageSchema: z.ZodObject<{
    input_tokens: z.ZodNumber;
    output_tokens: z.ZodNumber;
}, z.core.$strip>;
export declare function jevUsage(root: string): Promise<ContestJevUsage>;
export declare function auditedJevFetch(root: string, purpose: ContestJevRequest['purpose'], request?: typeof fetch): typeof fetch;
//# sourceMappingURL=contest-jev-audit.d.ts.map