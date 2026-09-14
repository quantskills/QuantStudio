import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MINIMAL_THEMES, minimalThemeStyle, minimalBackgroundImage } from "./minimal-themes.js";
import { CapabilityIcon } from "./CapabilityIcon.js";
import { ImageSquareIcon as ImageSquare, MoonIcon as Moon, SunIcon as Sun, } from '@phosphor-icons/react';
import { THEME_PRESETS, useThemePreset, setThemePreset } from "./theme-presets.js";
import { useBackgroundMotion, setBackgroundMotion } from "./animated-background.js";
import css from './QuantSkillsApp.module.css';
import { QUANTSKILLS_DARK_BACKGROUNDS, QUANTSKILLS_LIGHT_BACKGROUNDS, } from "./theme-backgrounds.js";
/**
 * Render the two QuantSkills palettes without changing the Host theme.
 * @param props - Current selection, writable state, and change callback.
 * @returns An accessible two-option appearance picker.
 */
export function QuantSkillsThemePicker({ scheme, lightBackground, darkBackground, disabled, onChange, onLightBackgroundChange, onDarkBackgroundChange, }) {
    const preset = useThemePreset();
    const motion = useBackgroundMotion();
    const backgrounds = scheme === 'light' ? QUANTSKILLS_LIGHT_BACKGROUNDS : QUANTSKILLS_DARK_BACKGROUNDS;
    const selectedBackground = scheme === 'light' ? lightBackground : darkBackground;
    const themeSections = [
        { id: 'glass', title: '玻璃与自然', detail: '完整主题 · 浅色与深色', description: '清透水波、雨窗微光、墨色山岚。移动鼠标留下波纹，轻点唤起涟漪；导航、按钮、文字和蒙层一起切换。' },
        { id: 'minimal', title: '极简流光', detail: '完整主题 · 深色', description: '流体光带、星尘与流星。移动鼠标聚拢粒子，点击泛起涟漪，滚动时光带随之流转。' },
    ];
    return _jsxs("fieldset", { className: css.themePicker, children: [_jsx("legend", { children: "\u8BA9\u5DE5\u4F5C\u7A7A\u95F4\u66F4\u50CF\u4F60" }), _jsx("p", { children: "\u4ECE\u754C\u9762\u5230\u56FE\u6807\uFF0C\u4E00\u8D77\u6362\u4E2A\u6C1B\u56F4\u3002" }), themeSections.map(section => _jsxs("section", { className: css.minimalThemeSection, children: [_jsxs("header", { children: [_jsx("h3", { children: section.title }), _jsx("span", { children: section.detail })] }), _jsx("p", { children: section.description }), _jsx("div", { className: css.minimalThemeGrid, children: MINIMAL_THEMES.filter(theme => theme.id.startsWith(`${section.id}-`)).map(theme => _jsxs("button", { type: "button", className: css.minimalThemeCard, "data-theme-scene": theme.scene, "data-theme-scheme": theme.scheme, "aria-label": `应用${theme.label}主题`, "aria-pressed": scheme === theme.scheme && selectedBackground === theme.background, style: minimalThemeStyle(theme), disabled: disabled, onClick: () => {
                                setThemePreset(theme.id);
                                onChange(theme.scheme);
                                if (theme.scheme === 'light')
                                    onLightBackgroundChange(theme.background);
                                else
                                    onDarkBackgroundChange(theme.background);
                            }, children: [_jsxs("span", { className: css.minimalThemePreview, style: { backgroundImage: minimalBackgroundImage(theme) }, "aria-hidden": "true", children: [_jsx("span", { className: css.previewRail, children: ['skill', 'agent', 'agent-team'].map(kind => _jsx(CapabilityIcon, { kind: kind, family: theme.family, size: 17, bare: true }, kind)) }), _jsxs("span", { className: css.previewContent, children: [_jsx("span", { className: css.previewHeading, children: "\u4E13\u6CE8\u4E8E\u4F60\u7684\u4E0B\u4E00\u6B65" }), _jsxs("span", { className: css.previewPanel, children: [_jsx("span", { children: "\u7814\u7A76\u5DE5\u4F5C\u7A7A\u95F4" }), _jsx("i", {}), _jsx("i", {}), _jsxs("em", { children: ["\u5F00\u59CB\u7814\u7A76 ", _jsx("span", { children: "\u2197" })] })] })] })] }), _jsxs("span", { className: css.minimalThemeCaption, children: [_jsx("b", { children: theme.label }), _jsx("span", { className: css.themeSelected, children: scheme === theme.scheme && selectedBackground === theme.background ? '已启用' : '应用主题' })] }), _jsx("small", { children: theme.description }), _jsx("small", { className: css.themeIconLegend, children: theme.iconLabel })] }, theme.id)) })] }, section.id)), ['light', 'dark'].map(group => _jsxs("section", { className: css.presetSection, children: [_jsx("h3", { children: group === 'light' ? '明亮系列' : '深色系列' }), _jsx("div", { className: css.presetGrid, children: THEME_PRESETS.filter(theme => theme.scheme === group && !MINIMAL_THEMES.some(profile => profile.id === theme.id)).map(theme => _jsxs("button", { type: "button", className: css.presetCard, "data-preset": theme.id, "aria-pressed": preset === theme.id && scheme === theme.scheme && selectedBackground === 'none', disabled: disabled, onClick: () => {
                                setThemePreset(theme.id);
                                onChange(theme.scheme);
                                if (theme.scheme === 'light')
                                    onLightBackgroundChange('none');
                                else
                                    onDarkBackgroundChange('none');
                            }, children: [_jsx("span", { className: css.presetSwatch, children: theme.scheme === 'dark' ? _jsx(Moon, { size: 26, weight: "duotone" }) : _jsx(Sun, { size: 26, weight: "duotone" }) }), _jsx("b", { children: theme.label }), _jsx("small", { children: theme.description })] }, theme.id)) })] }, group)), _jsxs("div", { className: css.themeChoices, "aria-label": "\u660E\u6697\u6A21\u5F0F", children: [_jsxs("button", { type: "button", className: css.themeChoice, disabled: disabled, "aria-pressed": scheme === 'light', onClick: () => { onChange('light'); }, children: [_jsx(Sun, { size: 18 }), _jsx("span", { children: "\u660E\u4EAE" })] }), _jsxs("button", { type: "button", className: css.themeChoice, disabled: disabled, "aria-pressed": scheme === 'dark', onClick: () => { onChange('dark'); }, children: [_jsx(Moon, { size: 18 }), _jsx("span", { children: "\u6DF1\u8272" })] })] }), _jsxs("div", { className: css.backgroundPickerHeader, children: [_jsx("b", { children: scheme === 'light' ? '明亮背景' : '深色背景' }), _jsx("small", { children: "\u660E\u4EAE\u548C\u6DF1\u8272\u6A21\u5F0F\u5206\u522B\u4FDD\u5B58\uFF1B\u52A8\u6001\u573A\u666F\u4E5F\u4F1A\u5207\u6362\u914D\u8272\u4E0E\u56FE\u6807" })] }), _jsxs("label", { className: css.motionToggle, children: [_jsxs("span", { children: [_jsx("b", { children: "\u80CC\u666F\u52A8\u6548" }), _jsx("small", { children: "\u5207\u6362\u5230\u540E\u53F0\u6216\u7CFB\u7EDF\u5F00\u542F\u51CF\u5C11\u52A8\u6001\u6548\u679C\u65F6\u81EA\u52A8\u6682\u505C" })] }), _jsx("input", { type: "checkbox", role: "switch", "aria-label": "\u80CC\u666F\u52A8\u6548", checked: motion, onChange: event => setBackgroundMotion(event.target.checked) })] }), _jsx("div", { className: css.backgroundChoices, children: backgrounds.filter(background => !MINIMAL_THEMES.some(theme => theme.background === background.id)).map(background => _jsxs("button", { type: "button", className: css.backgroundChoice, "aria-label": background.id === 'none' ? '不使用背景图片' : `使用${background.label}背景`, "aria-pressed": background.id === selectedBackground, disabled: disabled, onClick: () => {
                        if (scheme === 'light')
                            onLightBackgroundChange(background.id);
                        else
                            onDarkBackgroundChange(background.id);
                    }, children: [background.url === undefined
                            ? _jsx("span", { className: css.backgroundChoiceEmpty, "aria-hidden": "true", children: _jsx(ImageSquare, { size: 24 }) })
                            : _jsx("img", { src: background.url, style: { objectPosition: background.position }, alt: "", "aria-hidden": "true" }), _jsxs("span", { children: [background.label, background.id.startsWith('motion-') && _jsx("small", { children: " \u00B7 \u52A8\u6001" })] })] }, background.id)) })] });
}
//# sourceMappingURL=QuantSkillsThemePicker.js.map