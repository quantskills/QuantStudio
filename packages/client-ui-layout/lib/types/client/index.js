import { AppFrame } from "./AppFrame.js";
import { createLayoutStore } from "./stores.js";
import { LayoutController } from "./service.js";
import { en, zh } from "./shortcut-locales.js";
import { ThemePresenter } from "./theme-presenter.js";
// Contract exports only (export-convergence rule: cross-package consumers
// keep a symbol exported; test-only/package-internal symbols live off /src).
// ILayout: the ctx.layout face consumers and test fakes type against.
// OwnerShare contracts below are the render-side halves registrants compose
// against; the frame components and the store factory are package-internal.
export { LayoutController } from "./service.js";
/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
export const inject = ['slots', 'theme', 'locale', 'shortcuts'];
/**
 * Client plugin body: provide ctx.layout, then one register() call — AppFrame
 * into 'root' with its child-slot declarations, the layout store seat,
 * and the shared root instance supplying commands and the panel-info source.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register('shortcuts.layout', { zh, en }), 'layout: command labels');
    const t = ctx.locale.bind('shortcuts.layout');
    ctx.effect(() => {
        const handle = createLayoutStore();
        const instance = handle.create();
        const store = { ...handle, create: () => instance };
        const retainMainPanels = () => {
            instance.actions.retainMainPanels(ctx.slots.entries('main').flatMap(entry => entry.options.key === undefined ? [] : [entry.options.key]));
        };
        const panelInfo = {
            getSnapshot: () => instance.getSnapshot().panelInfo,
            subscribe: listener => instance.subscribe(listener),
        };
        const layout = new LayoutController(instance.actions, id => ctx.slots.entries('main').some(entry => entry.options.key === id), panelInfo);
        const disposePanelInfo = ctx.slots.provideRoot({ hooks: { panelInfo: layout.panelInfo } });
        const disposeService = ctx.reflect.provide('layout', layout);
        const disposeRegistration = ctx.slots.register({
            name: 'root',
            locale: 'common',
            children: {
                'sidebar': { kind: 'single', scope: 'root' },
                'main': { kind: 'keyed', scope: 'root' },
                'rightbar': { kind: 'single', scope: 'root' },
                'shell.bottom': { kind: 'single', scope: 'root' },
                'shell.overlay': { kind: 'list', scope: 'root' },
                'shell.leading': { kind: 'single', scope: 'root' },
            },
            store,
        }, AppFrame);
        const disposeShortcut = ctx.shortcuts.register({
            id: 'sidebar.left.toggle', label: () => t('toggle'), aliases: ['sidebar', 'toggle left sidebar'],
            defaults: {
                'desktop:macos': { code: 'KeyB', modifiers: ['primary'] },
                'desktop:windows': { code: 'KeyB', modifiers: ['primary'] },
                'desktop:linux': { code: 'KeyB', modifiers: ['primary'] },
                'web:macos': { code: 'KeyB', modifiers: ['primary', 'alt'] },
                'web:windows': { code: 'KeyB', modifiers: ['primary', 'alt'] },
            },
            regions: ['page', 'editable'], modals: [],
            resolve: () => ({ status: 'handled', run: () => { layout.toggleSidebar(); } }),
        });
        const disposePanels = ctx.slots.subscribe('main', retainMainPanels);
        retainMainPanels();
        return () => {
            disposeShortcut();
            layout.dispose();
            disposePanels();
            disposeRegistration();
            disposePanelInfo();
            // provide()'s disposer settles asynchronously; teardown is synchronous fire-and-forget.
            void disposeService();
        };
    }, 'ui-layout: service + root registration');
    // Theme presentation: pure DOM writes from resolved snapshots — initial
    // state through the getter once, then event-driven only; no React path.
    ctx.effect(() => {
        const presenter = new ThemePresenter();
        presenter.apply(ctx.theme.getTheme());
        const off = ctx.on('theme/change', (snapshot) => { presenter.apply(snapshot); });
        return () => {
            off();
            presenter.dispose();
        };
    }, 'ui-layout: theme presenter');
}
//# sourceMappingURL=index.js.map