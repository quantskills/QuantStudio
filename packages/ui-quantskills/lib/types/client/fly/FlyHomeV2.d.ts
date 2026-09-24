import type { LifeTraceData, LifeFeedback } from './LifeTrace';
export interface BodyState {
    life_trace?: LifeTraceData;
    last_life_feedback?: LifeFeedback;
    wait_reason?: {
        code: string;
        message: string;
        recovery_seconds?: number;
    } | null;
    position: number[];
    action: string;
    goal: string;
    energy: number;
    hunger: number;
    curiosity: number;
    stress: number;
    event: string;
    target?: string;
    yaw?: number;
    controller?: string;
    effect_remaining?: number;
    effect?: {
        event: string;
        before: string;
        after: string;
        at: number;
        status: string;
    };
    food?: {
        id: string;
        name: string;
        position: number[];
        available: boolean;
    }[];
}
export default function FlyHomeV2({ body, version, paused }: {
    body: BodyState;
    version: string;
    paused: boolean;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyHomeV2.d.ts.map
