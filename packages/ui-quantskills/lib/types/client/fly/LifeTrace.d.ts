export type LifeFeedback = {
    decision_id: string;
    goal: string;
    reward: number;
    reason: string;
    active_seconds: number;
    distance: number;
    meals: unknown[];
    before: {
        energy: number;
    };
    after: {
        energy: number;
    };
    blocked_seconds: number;
};
export type LifeTraceData = {
    decision_id: string;
    perception: {
        values: Record<string, number>;
        visible_food: number;
        obstacle_distance: number | null;
    };
    response: Record<string, {
        value: number;
        mean_spikes: number;
        active: number;
        neurons: number;
        valid: boolean;
    }>;
    choice: {
        action: string;
        scores: Record<string, number>;
    };
    motor: {
        confidence: number;
        drive: number;
    };
    navigation: {
        cue: string;
    };
    feedback?: LifeFeedback | null;
};
export declare const lifeGoals: Record<string, string>;
export declare function LifeTrace({ trace, previous }: {
    trace?: LifeTraceData | undefined;
    previous?: LifeFeedback | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=LifeTrace.d.ts.map