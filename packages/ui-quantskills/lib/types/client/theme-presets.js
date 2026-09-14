import { useSyncExternalStore } from 'react';
import { MINIMAL_THEMES } from "./minimal-themes.js";
export const THEME_PRESETS = [
    ...MINIMAL_THEMES,
    { id: 'silver', label: '云白', description: '通透留白，专注当下', scheme: 'light', accent: '#0067d9' },
    { id: 'graphite', label: '石墨', description: '柔和暗色，沉浸创作', scheme: 'dark', accent: '#75b5ff' },
    { id: 'ocean', label: '海蓝', description: '清凉蓝调，轻盈有序', scheme: 'light', accent: '#007e91' },
    { id: 'violet', label: '暮紫', description: '细腻紫调，多一点灵感', scheme: 'light', accent: '#7952c7' },
    { id: 'midnight', label: '午夜蓝', description: '深海底色，冷静专注', scheme: 'dark', accent: '#89baff' },
    { id: 'plum', label: '夜紫', description: '柔紫微光，安静创作', scheme: 'dark', accent: '#c6adff' },
    { id: 'forest', label: '墨绿', description: '森林深处，舒缓护眼', scheme: 'dark', accent: '#8fd6b8' },
];
const key = 'quantskills.appearance.preset';
const changed = 'quantskills-theme-preset';
const read = () => {
    try {
        const saved = localStorage.getItem(key);
        return THEME_PRESETS.find(theme => theme.id === saved)?.id ?? 'minimal-blue';
    }
    catch {
        return 'minimal-blue';
    }
};
let memory;
function subscribe(listener) {
    const storage = () => { memory = undefined; listener(); };
    window.addEventListener(changed, listener);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(changed, listener); window.removeEventListener('storage', storage); };
}
export function useThemePreset() { return useSyncExternalStore(subscribe, () => memory ?? read(), () => 'minimal-blue'); }
export function setThemePreset(value) {
    memory = value;
    try {
        localStorage.setItem(key, value);
    }
    catch { /* Keep usable when storage is unavailable. */ }
    window.dispatchEvent(new Event(changed));
}
//# sourceMappingURL=theme-presets.js.map