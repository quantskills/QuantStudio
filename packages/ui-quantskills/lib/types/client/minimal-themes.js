/** Complete interactive profiles. The same tokens drive the live UI and picker previews. */
export const MINIMAL_THEMES = [
    {
        id: 'minimal-blue', background: 'motion-minimal-blue', label: '极简 · 雾蓝',
        description: '冷蓝流光，清晰有序', scheme: 'dark', scene: 'flow', family: 'geometry',
        iconLabel: '晶体 · 立方 · 模组', accent: '#9bbff1',
        tokens: { accent: '#9bbff1', tint: '#25364e', chrome: '#0e1827', surface: '#1b293c', ink: '#ecf2fa', secondary: '#acbcd0', line: '#38485e', deep: '#091321', buttonInk: '#091321', skill: '#c9b1ff', agent: '#79ded4', team: '#f3ce8e', success: '#88d9b2', warning: '#f3ce8e', danger: '#ff9f9c' },
        glow: '90, 141, 212',
    },
    {
        id: 'minimal-jade', background: 'motion-minimal-jade', label: '极简 · 青玉',
        description: '青绿呼吸，温润宁静', scheme: 'dark', scene: 'flow', family: 'botanical',
        iconLabel: '叶片 · 树木 · 枝系', accent: '#9cd4bc',
        tokens: { accent: '#9cd4bc', tint: '#254239', chrome: '#101e1b', surface: '#1d3029', ink: '#edf5ef', secondary: '#afc3ba', line: '#3c5349', deep: '#0a1612', buttonInk: '#0a1612', skill: '#e1cd8e', agent: '#8dcdf0', team: '#d1b4f3', success: '#96d9b0', warning: '#efc591', danger: '#f7a3a3' },
        glow: '89, 160, 130',
    },
    {
        id: 'minimal-copper', background: 'motion-minimal-copper', label: '极简 · 暖铜',
        description: '琥珀余光，沉静细腻', scheme: 'dark', scene: 'flow', family: 'atelier',
        iconLabel: '羽笔 · 笔尖 · 叠页', accent: '#e6ba91',
        tokens: { accent: '#e6ba91', tint: '#49372c', chrome: '#211a16', surface: '#332920', ink: '#f7f0e8', secondary: '#ccbbaa', line: '#58483c', deep: '#17110e', buttonInk: '#17110e', skill: '#f0b1a8', agent: '#b5bffc', team: '#8fd6c3', success: '#9cd8ad', warning: '#edd187', danger: '#ffabab' },
        glow: '181, 125, 76',
    },
    {
        id: 'glass-blue', background: 'motion-glass-blue', label: '琉璃 · 浅蓝',
        description: '浅蓝水光，琉璃映照', scheme: 'light', scene: 'lagoon', family: 'lagoon',
        iconLabel: '水滴 · 气泡 · 涟漪', accent: '#1266a2',
        tokens: { accent: '#1266a2', tint: '#d8eaf8', chrome: '#e5f2fc', surface: '#f3faff', ink: '#16334d', secondary: '#405e76', line: '#aac8dc', deep: '#dceefb', buttonInk: '#ffffff', skill: '#6c51a3', agent: '#0c706e', team: '#98572a', success: '#24704a', warning: '#89561c', danger: '#ac454c' },
        glow: '68, 148, 207',
    },
    {
        id: 'glass-rain', background: 'motion-glass-rain', label: '雨季 · 听雨',
        description: '雨落玻璃，青黛微光', scheme: 'dark', scene: 'rain', family: 'rain',
        iconLabel: '雨滴 · 雨云 · 雨伞', accent: '#a1d3dd',
        tokens: { accent: '#a1d3dd', tint: '#354957', chrome: '#142631', surface: '#25333e', ink: '#eff7fa', secondary: '#b8ccd3', line: '#495f6c', deep: '#0e1d28', buttonInk: '#0e1d28', skill: '#adc4f3', agent: '#92d7c3', team: '#dec49d', success: '#97d8b4', warning: '#e5c791', danger: '#f1a5ad' },
        glow: '92, 144, 158',
    },
    {
        id: 'glass-ink', background: 'motion-glass-ink', label: '水墨 · 山岚',
        description: '墨色游走，山岚留白', scheme: 'light', scene: 'ink', family: 'ink',
        iconLabel: '笔触 · 山峦 · 山水', accent: '#315953',
        tokens: { accent: '#315953', tint: '#e3e8e0', chrome: '#efefe7', surface: '#faf9f3', ink: '#242f30', secondary: '#505f5b', line: '#b9c3b8', deep: '#e9ece4', buttonInk: '#ffffff', skill: '#a64435', agent: '#365f73', team: '#686040', success: '#3f6748', warning: '#885e21', danger: '#a53d42' },
        glow: '98, 126, 116',
    },
];
export const findMinimalTheme = (background) => MINIMAL_THEMES.find(theme => theme.background === background);
export function minimalThemeStyle(theme) {
    return Object.fromEntries([
        ...Object.entries(theme.tokens).map(([key, value]) => [`--qs-${key}`, value]),
        ['--qs-flow-rgb', theme.glow],
    ]);
}
export function minimalBackgroundImage(theme) {
    return `radial-gradient(ellipse at 75% 12%, rgba(${theme.glow}, .18), transparent 62%), linear-gradient(135deg, ${theme.tokens.deep}, ${theme.tokens.chrome} 55%, ${theme.tokens.deep})`;
}
//# sourceMappingURL=minimal-themes.js.map