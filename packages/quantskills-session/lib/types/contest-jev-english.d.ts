import type { Context } from '@deepseek-ai/cordis';
import { z } from 'zod';
declare const selection: z.ZodObject<{
    provider: z.ZodString;
    model: z.ZodString;
}, z.core.$strict>;
export type JevTranslator = z.infer<typeof selection>;
export declare function englishJevBody(value: unknown): string;
export declare function translationModels(ctx: Context): JevTranslator[];
export declare function readTranslator(root?: string): Promise<JevTranslator | undefined>;
export declare function saveTranslator(ctx: Context, root: string, input: unknown): Promise<void>;
export declare function englishJevInput<T>(ctx: Context, original: T, signal: AbortSignal, root?: string): Promise<T>;
export {};
//# sourceMappingURL=contest-jev-english.d.ts.map