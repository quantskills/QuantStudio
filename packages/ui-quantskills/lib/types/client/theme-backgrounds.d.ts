import type { QuantSkillsColorScheme, QuantSkillsDarkBackground, QuantSkillsLightBackground } from '../appearance-settings.ts';
/** One real background asset exposed by the QuantSkills appearance picker. */
export interface QuantSkillsBackgroundOption<Id extends string> {
    /** Stable preference value. */
    readonly id: Id;
    /** Short user-facing name. */
    readonly label: string;
    /** Imported browser asset URL; absent means the palette has no image. */
    readonly url?: string;
    /** Code-native gradient for interactive theme profiles. */
    readonly gradient?: string;
    /** Focal point retained when the viewport crops the image. */
    readonly position: string;
}
export declare const MOTION_BACKGROUNDS: readonly [{
    readonly id: "motion-cosmos";
    readonly label: "宇宙星辰";
    readonly url: string;
    readonly position: "center center";
}, {
    readonly id: "motion-ocean";
    readonly label: "深海";
    readonly url: string;
    readonly position: "center center";
}, {
    readonly id: "motion-meadow";
    readonly label: "青青草原";
    readonly url: string;
    readonly position: "center center";
}, {
    readonly id: "motion-jiangnan";
    readonly label: "江南武侠";
    readonly url: string;
    readonly position: "center center";
}, {
    readonly id: "motion-cyber";
    readonly label: "赛博朋克";
    readonly url: string;
    readonly position: "center center";
}];
/** Light-palette backgrounds selected for the v0.1.19 visual refresh. */
export declare const QUANTSKILLS_LIGHT_BACKGROUNDS: readonly QuantSkillsBackgroundOption<QuantSkillsLightBackground>[];
/** Dark-palette backgrounds selected for the v0.1.19 visual refresh. */
export declare const QUANTSKILLS_DARK_BACKGROUNDS: readonly QuantSkillsBackgroundOption<QuantSkillsDarkBackground>[];
/** Resolve the currently visible background from both durable palette selections. */
export declare function resolveQuantSkillsBackground(scheme: QuantSkillsColorScheme, lightBackground: QuantSkillsLightBackground, darkBackground: QuantSkillsDarkBackground): QuantSkillsBackgroundOption<QuantSkillsLightBackground | QuantSkillsDarkBackground>;
//# sourceMappingURL=theme-backgrounds.d.ts.map