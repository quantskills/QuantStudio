import { useSyncExternalStore } from 'react';
import { SparkleIcon, PlanetIcon, SpiralIcon, DiamondIcon, CubeIcon, HexagonIcon, LeafIcon, TreeIcon, TreeStructureIcon, FeatherIcon, PenNibIcon, StackIcon, DropIcon, FishIcon, WavesIcon, FlowerIcon, ButterflyIcon, TreeEvergreenIcon, FanIcon, MountainsIcon, LightningIcon, CpuIcon, CircuitryIcon, CirclesThreeIcon, DropHalfIcon, CloudRainIcon, UmbrellaIcon, PaintBrushIcon, IslandIcon, } from '@phosphor-icons/react';
export const THEME_ICON_FAMILIES = {
    cosmos: [SparkleIcon, PlanetIcon, SpiralIcon],
    geometry: [DiamondIcon, CubeIcon, HexagonIcon],
    botanical: [LeafIcon, TreeIcon, TreeStructureIcon],
    atelier: [FeatherIcon, PenNibIcon, StackIcon],
    ocean: [DropIcon, FishIcon, WavesIcon],
    meadow: [FlowerIcon, ButterflyIcon, TreeEvergreenIcon],
    jiangnan: [LeafIcon, FanIcon, MountainsIcon],
    cyber: [LightningIcon, CpuIcon, CircuitryIcon],
    lagoon: [DropIcon, CirclesThreeIcon, WavesIcon],
    rain: [DropHalfIcon, CloudRainIcon, UmbrellaIcon],
    ink: [PaintBrushIcon, MountainsIcon, IslandIcon],
};
export function resolveThemeIconFamily(background, preset) {
    const scenes = {
        'motion-minimal-blue': 'geometry', 'motion-minimal-jade': 'botanical', 'motion-minimal-copper': 'atelier',
        'motion-glass-blue': 'lagoon', 'motion-glass-rain': 'rain', 'motion-glass-ink': 'ink',
        'motion-ocean': 'ocean', 'motion-meadow': 'meadow', 'motion-jiangnan': 'jiangnan', 'motion-cyber': 'cyber',
    };
    if (scenes[background])
        return scenes[background];
    if (background !== 'none')
        return 'cosmos';
    return { ocean: 'ocean', forest: 'botanical', silver: 'geometry', graphite: 'geometry', violet: 'atelier', 'glass-blue': 'lagoon', 'glass-rain': 'rain', 'glass-ink': 'ink' }[preset] ?? 'cosmos';
}
// One observer for all icons, including portals and native conversation tool cards.
const listeners = new Set();
let observer;
function subscribe(listener) {
    listeners.add(listener);
    if (!observer) {
        observer = new MutationObserver(() => { for (const notify of listeners)
            notify(); });
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-qs-background', 'data-qs-preset'] });
    }
    return () => { listeners.delete(listener); if (!listeners.size) {
        observer?.disconnect();
        observer = undefined;
    } };
}
export function useThemeIconFamily() {
    return useSyncExternalStore(subscribe, () => resolveThemeIconFamily(document.body.dataset.qsBackground ?? 'none', document.body.dataset.qsPreset ?? ''), () => 'cosmos');
}
//# sourceMappingURL=theme-icons.js.map