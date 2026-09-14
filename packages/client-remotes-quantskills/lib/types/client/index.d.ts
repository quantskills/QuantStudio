/** Client assembly for the generated QuantSkills Host Remote contributions. */
import type { Context } from '@deepseek-ai/cordis';
import type { TypertClientRemote } from '@deepseek-ai/dsh-typert-protocol';
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Generated QuantSkills Remote namespaces mounted before the application UI. */
        remote: TypertClientRemote;
    }
}
/** Base Remote service required before generated namespaces can mount. */
export declare const inject: string[];
/**
 * Mount the generated QuantSkills Remote namespaces before the UI requests them.
 * @param ctx - Client Cordis root carrying the typed Remote service.
 * @returns disposer that unmounts every namespace in reverse order.
 */
export declare function apply(ctx: Context): Promise<() => Promise<void>>;
//# sourceMappingURL=index.d.ts.map