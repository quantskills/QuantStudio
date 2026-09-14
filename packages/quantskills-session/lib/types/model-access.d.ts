import type { Context } from '@deepseek-ai/cordis';
import type { ModelAccessRequest, ModelAccessResponse, ModelConnectionDraft } from './model-access-types.ts';
/** Sanitized endpoint contract. Never redirects credentials or copies them into query strings. */
export declare function modelDiscoveryRequest(draft: ModelConnectionDraft, key: string): {
    url: string;
    headers: Record<string, string>;
};
/** Host-only credential/config orchestrator. No DOM bridge and no second credential store. */
export declare class QuantSkillsModelAccess {
    private readonly ctx;
    private readonly request;
    private tail;
    private services;
    private readonly proofs;
    constructor(ctx: Context, _codexExecutable?: string, request?: typeof fetch);
    private profiles;
    private get connected();
    private policies;
    private fingerprint;
    private policy;
    private connections;
    private verify;
    /** Writes serialize across tabs so stale connection forms cannot drop other providers. */
    run(input: ModelAccessRequest): Promise<ModelAccessResponse>;
    private execute;
    private save;
    /** Fill only missing catalog facts; explicit saved overrides always win. */
    private modelProfile;
}
//# sourceMappingURL=model-access.d.ts.map