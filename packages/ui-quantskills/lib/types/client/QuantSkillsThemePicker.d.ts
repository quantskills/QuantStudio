import type { QuantSkillsColorScheme, QuantSkillsDarkBackground, QuantSkillsLightBackground } from '../appearance-settings.ts';
/** Props for the QuantSkills-owned light and dark appearance picker. */
export interface QuantSkillsThemePickerProps {
    /** Current QuantSkills palette. */
    scheme: QuantSkillsColorScheme;
    /** Background saved for the light palette. */
    lightBackground: QuantSkillsLightBackground;
    /** Background saved for the dark palette. */
    darkBackground: QuantSkillsDarkBackground;
    /** Whether Host preferences are writable. */
    disabled: boolean;
    /** Persist the selected QuantSkills palette. */
    onChange: (scheme: QuantSkillsColorScheme) => void;
    /** Persist the selected light-palette background. */
    onLightBackgroundChange: (background: QuantSkillsLightBackground) => void;
    /** Persist the selected dark-palette background. */
    onDarkBackgroundChange: (background: QuantSkillsDarkBackground) => void;
}
/**
 * Render the two QuantSkills palettes without changing the Host theme.
 * @param props - Current selection, writable state, and change callback.
 * @returns An accessible two-option appearance picker.
 */
export declare function QuantSkillsThemePicker({ scheme, lightBackground, darkBackground, disabled, onChange, onLightBackgroundChange, onDarkBackgroundChange, }: QuantSkillsThemePickerProps): import("react").JSX.Element;
//# sourceMappingURL=QuantSkillsThemePicker.d.ts.map