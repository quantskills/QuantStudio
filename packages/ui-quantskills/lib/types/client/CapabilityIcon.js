import { jsx as _jsx } from "react/jsx-runtime";
import { THEME_ICON_FAMILIES, useThemeIconFamily } from "./theme-icons.js";
import css from './QuantSkillsApp.module.css';
/** Friendly, distinct library identities using the shared Phosphor icon family. */
export function CapabilityIcon({ kind, size = 24, family, bare = false }) {
    const currentFamily = useThemeIconFamily();
    const selected = family ?? currentFamily;
    const Icon = THEME_ICON_FAMILIES[selected][kind === 'skill' ? 0 : kind === 'agent' ? 1 : 2];
    return _jsx("span", { className: css.capabilityIcon, "data-kind": kind, "data-family": selected, "data-bare": bare || undefined, "aria-hidden": "true", children: _jsx(Icon, { size: size, weight: "regular" }) });
}
//# sourceMappingURL=CapabilityIcon.js.map