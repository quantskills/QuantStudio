import type { JsonValue } from '@deepseek-ai/dsh-util-values';
/** Public connection contract: no method ever returns a credential value. */
export interface ModelServiceVariant {
    id: string;
    name: string;
    baseURL: string;
    catalogProvider?: string;
}
export type ModelRecommendationRole = 'economy' | 'balanced' | 'frontier' | 'coding' | 'vision' | 'long-context' | 'low-latency';
/** Informational directory entry. It never grants routing or verification status. */
export interface ModelServiceRecommendation {
    name: string;
    /** True only when `name` is an API-callable model id, rather than a vendor family name. */
    exactId: boolean;
    roles: ModelRecommendationRole[];
    summary: string;
    lifecycle?: 'stable' | 'preview' | 'experimental';
    source: string;
    checkedAt: string;
}
export interface ModelServiceDefinition {
    id: string;
    name: string;
    api: string;
    variants: ModelServiceVariant[];
    docs: string;
    discovery: boolean;
    /** Discoverable before connection, but never copied into a live route automatically. */
    recommendations?: ModelServiceRecommendation[];
}
export interface ModelConnectionDraft {
    route?: string | undefined;
    service: string;
    name: string;
    baseURL: string;
    api: string;
    apiKey?: string | undefined;
    modelIds: string[];
    auto: boolean;
    /** Optional route default used by the adapter for every model on this route. */
    reasoning?: string | undefined;
    /** Optional advanced model declarations; omitted preserves existing overrides. */
    modelsJson?: string | undefined;
}
export interface ModelConnection {
    route: string;
    service: string;
    name: string;
    baseURL: string;
    api: string;
    configured: boolean;
    auto: boolean;
    modelIds: string[];
    modelsJson: string;
    reasoning?: string;
    state: string;
    message: string;
}
export interface ModelVerification {
    state: 'verified' | 'discovery-unavailable' | 'failed';
    code: string;
    message: string;
    modelIds: string[];
    /** Host-suggested safe model declarations derived from a trusted service preset. */
    modelProfiles?: Record<string, JsonValue>[];
}
export interface ModelAccessRequest {
    action: 'list' | 'verify' | 'save' | 'remove' | 'auto' | 'test';
    model?: string;
    draft?: ModelConnectionDraft;
    route?: string;
    enabled?: boolean;
}
export interface ModelAccessResponse {
    catalog: ModelServiceDefinition[];
    connections: ModelConnection[];
    verification?: ModelVerification;
}
//# sourceMappingURL=model-access-types.d.ts.map