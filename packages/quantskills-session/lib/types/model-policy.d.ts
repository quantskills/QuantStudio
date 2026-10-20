/** Loader-owned model authorization. Saved policy never defaults a new route to authorized. */
import type { Context } from '@deepseek-ai/cordis';
import s from '@deepseek-ai/schemastery';
export declare const name = "quantskills-model-services";
export declare const Config: s<NoInfer<Schemastery.ObjectS<NoInfer<{
    connections: s<import("@deepseek-ai/cosmokit").Dict<{
        service?: string | null;
        auto?: boolean | null;
        state?: string | null;
        message?: string | null;
        verifiedModels?: string[] | null;
    } & import("@deepseek-ai/cosmokit").Dict, string>, import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
        service: s<string, string, "plain">;
        auto: s<boolean, boolean, "defined">;
        state: s<string, string, "plain">;
        message: s<string, string, "plain">;
        verifiedModels: s<string[], string[], "plain">;
    }>>, string>, "defined">;
}>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    connections: s<import("@deepseek-ai/cosmokit").Dict<{
        service?: string | null;
        auto?: boolean | null;
        state?: string | null;
        message?: string | null;
        verifiedModels?: string[] | null;
    } & import("@deepseek-ai/cosmokit").Dict, string>, import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
        service: s<string, string, "plain">;
        auto: s<boolean, boolean, "defined">;
        state: s<string, string, "plain">;
        message: s<string, string, "plain">;
        verifiedModels: s<string[], string[], "plain">;
    }>>, string>, "defined">;
}>>>, "volatile">;
export declare function apply(_ctx: Context): void;
//# sourceMappingURL=model-policy.d.ts.map