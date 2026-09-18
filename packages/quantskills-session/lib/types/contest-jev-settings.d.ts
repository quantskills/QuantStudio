import type { Context } from '@deepseek-ai/cordis';
import type { ContestJevSettings } from './contest-watch-types.ts';
import { type JevTranslator } from './contest-jev-english.ts';
export declare function jevSettings(ctx: Context, root?: string): Promise<ContestJevSettings>;
/** A supplied key is saved only after a real, synthetic connection test succeeds. */
export declare function configureJev(ctx: Context, input: {
    apiKey?: string;
    translator?: JevTranslator;
}, request?: typeof fetch, root?: string): Promise<ContestJevSettings>;
//# sourceMappingURL=contest-jev-settings.d.ts.map