import type { ModelServiceDefinition } from './model-access-types.ts';
import type { JsonValue } from '@deepseek-ai/dsh-util-values';
/** Official endpoint and public model-directory contracts checked 2026-09-06. No credentials or inferred prices. */
export declare const MODEL_SERVICES: ModelServiceDefinition[];
/**
 * Trusted capability declarations that a bare `/models` response cannot carry.
 * MiniMax M3 uses adaptive thinking on the wire. The product keeps its common
 * strength vocabulary so users can choose a portable intent while the provider
 * adapter performs the vendor-specific mapping.
 */
export declare function isKimiCodeEndpoint(api: string, baseURL: string | undefined): boolean;
/** Default route strength for an official endpoint whose documented models reason by default. */
export declare function suggestedRouteReasoning(api: string, baseURL: string | undefined, ids: readonly string[]): string | undefined;
export declare function suggestedModelProfile(service: string, api: string, id: string, baseURL?: string): Record<string, JsonValue>;
//# sourceMappingURL=model-service-catalog.d.ts.map