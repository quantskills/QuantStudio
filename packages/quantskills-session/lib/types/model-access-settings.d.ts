import type { Context } from '@deepseek-ai/cordis';
export declare const MODEL_ACCESS_NS = "quantskills-model-services";
export interface ConnectionPolicy {
    service: string;
    auto: boolean;
    state: string;
    message: string;
    verifiedModels: string[];
}
export interface ModelAccessSettings {
    connections: Record<string, ConnectionPolicy>;
}
/** Auto admission is explicit: an exact route must be verified and user-approved. */
export declare function modelAllowedForAuto(ctx: Context, provider: string, model?: string): boolean;
//# sourceMappingURL=model-access-settings.d.ts.map