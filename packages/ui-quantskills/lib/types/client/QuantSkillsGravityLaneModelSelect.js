import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** QuantSkills Gravity Lane model and reasoning-effort selector. */
import { CaretDown, CaretLeft, CaretRight, Check, RocketLaunch } from '@phosphor-icons/react';
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, } from 'react';
import css from './QuantSkillsGravityLaneModelSelect.module.css';
function laneState(index, count, effort) {
    const id = effort?.toLocaleLowerCase() ?? '';
    if (id === 'off' || id === 'none' || id.includes('disable'))
        return 'off';
    if (id === 'low' || id === 'minimal')
        return 'low';
    if (id === 'medium')
        return 'medium';
    if (id === 'high')
        return 'high';
    if (id === 'max' || id === 'xhigh' || id === 'x-high' || id === 'ultra' || id.includes('extreme'))
        return 'max';
    if (count <= 1 || index <= 0)
        return 'off';
    const ratio = index / (count - 1);
    return ratio <= 0.25 ? 'low' : ratio <= 0.5 ? 'medium' : ratio <= 0.75 ? 'high' : 'max';
}
function laneStyle(index, count) {
    const progress = count <= 1 ? 0 : index / (count - 1);
    return {
        '--qs-lane-progress': `${7 + progress * 86}%`,
        '--qs-lane-particle-width': `${7 + progress * 86}%`,
    };
}
/**
 * Render the QuantSkills-branded composer model seat and Gravity Lane slider.
 *
 * @param props - Shared model directory, model-selection action, lock state, and locale.
 * @returns The model trigger and its model/effort popover.
 */
export function QuantSkillsGravityLaneModelSelect({ locked, available, directory, load, select, t, }) {
    const state = useSyncExternalStore(callback => directory.subscribe(callback), () => directory.getSnapshot());
    const [open, setOpen] = useState(false);
    const [pane, setPane] = useState('root');
    const [previewEffortIndex, setPreviewEffortIndex] = useState();
    const rootRef = useRef(null);
    const triggerRef = useRef(null);
    const id = useId();
    const choices = useMemo(() => state.groups.flatMap(group => group.models.map(model => ({
        group,
        model,
        selection: {
            provider: group.id,
            model: model.id,
            ...(model.reasoning?.defaultEffort === undefined
                ? {}
                : { reasoningEffort: model.reasoning.defaultEffort }),
        },
    }))), [state.groups]);
    const currentChoice = state.current === null
        ? undefined
        : choices.find(choice => choice.selection.provider === state.current?.provider
            && choice.selection.model === state.current.model);
    const reasoning = currentChoice?.model.reasoning;
    const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
    const effortChoices = useMemo(() => reasoning === undefined
        ? []
        : [
            ...(reasoning.defaultEffort === undefined
                ? [{ key: 'provider-default', effort: undefined, label: t('effort.providerDefault') }]
                : []),
            ...reasoning.efforts.map(effort => ({
                key: `effort:${effort.id}`,
                effort: effort.id,
                label: effort.name,
            })),
        ], [reasoning, t]);
    const resolvedEffortIndex = Math.max(0, effortChoices.findIndex(choice => choice.effort === effectiveEffort));
    const displayedEffortIndex = Math.min(Math.max(previewEffortIndex ?? resolvedEffortIndex, 0), Math.max(effortChoices.length - 1, 0));
    const displayedEffort = effortChoices[displayedEffortIndex];
    const visualState = laneState(displayedEffortIndex, effortChoices.length, displayedEffort?.effort);
    const waiting = state.current === null && state.status === 'loading';
    const modelLabel = waiting
        ? t('trigger.loading')
        : currentChoice?.model.name ?? (state.current === null
            ? t('trigger.fallback')
            : `${state.current.provider}/${state.current.model}`);
    const effortLabel = displayedEffort?.label;
    const triggerLabel = effortLabel === undefined ? modelLabel : `${modelLabel} · ${effortLabel}`;
    const triggerAria = waiting
        ? t('trigger.loading')
        : state.current === null
            ? t('trigger.selectAria')
            : effortLabel === undefined
                ? t('trigger.aria', { model: modelLabel })
                : t('trigger.ariaEffort', { model: modelLabel, effort: effortLabel });
    const busy = state.status === 'selecting';
    useEffect(() => {
        setPreviewEffortIndex(undefined);
    }, [effectiveEffort]);
    useEffect(() => {
        if (!open)
            return;
        const closeOutside = (event) => {
            if (!rootRef.current?.contains(event.target))
                setOpen(false);
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => { document.removeEventListener('pointerdown', closeOutside); };
    }, [open]);
    if (!available)
        return null;
    const close = (restoreFocus = false) => {
        setOpen(false);
        setPane('root');
        if (restoreFocus)
            queueMicrotask(() => { triggerRef.current?.focus(); });
    };
    const show = () => {
        setPane('root');
        setOpen(true);
        load();
    };
    const chooseModel = (choice) => {
        if (state.current?.provider === choice.selection.provider
            && state.current.model === choice.selection.model) {
            close(true);
            return;
        }
        void select(choice.selection).then((accepted) => {
            if (accepted)
                close(true);
        });
    };
    const chooseEffort = (index) => {
        const choice = effortChoices[index];
        if (choice === undefined || state.current === null || choice.effort === effectiveEffort)
            return;
        setPreviewEffortIndex(index);
        const selection = {
            provider: state.current.provider,
            model: state.current.model,
            ...(choice.effort === undefined ? {} : { reasoningEffort: choice.effort }),
        };
        void select(selection).then((accepted) => {
            if (!accepted)
                setPreviewEffortIndex(undefined);
        });
    };
    return _jsxs("div", { ref: rootRef, className: css.root, "data-qs-gravity-lane": true, "data-lane-state": visualState, onKeyDown: (event) => {
            if (event.key !== 'Escape' || !open)
                return;
            event.preventDefault();
            if (pane === 'models')
                setPane('root');
            else
                close(true);
        }, children: [_jsxs("button", { ref: triggerRef, type: "button", className: css.trigger, "aria-label": triggerAria, "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": open ? `${id}-menu` : undefined, title: triggerLabel, disabled: locked, onClick: () => { if (open)
                    close();
                else
                    show(); }, children: [_jsx("span", { className: css.triggerLabel, children: modelLabel }), effortLabel !== undefined && _jsx("span", { className: css.triggerEffort, children: effortLabel }), _jsx(CaretDown, { size: 14, weight: "bold", className: open ? css.chevronOpen : css.chevron })] }), open && _jsxs("div", { id: `${id}-menu`, className: css.menu, role: "dialog", "aria-label": t('menu.aria'), "aria-busy": state.status === 'loading' || busy, children: [pane === 'root' && _jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: css.modelRow, onClick: () => { setPane('models'); }, children: [_jsx("span", { children: t('menu.model') }), _jsx("span", { className: css.modelValue, children: modelLabel }), _jsx(CaretRight, { size: 14 })] }), effortChoices.length === 0
                                ? _jsx("p", { className: css.empty, children: t('empty.efforts') })
                                : _jsxs("div", { className: css.laneSection, children: [_jsxs("div", { className: css.laneHeader, children: [_jsx("span", { children: t('menu.effort') }), _jsx("strong", { children: effortLabel })] }), _jsxs("div", { className: css.lane, style: laneStyle(displayedEffortIndex, effortChoices.length), children: [_jsx("span", { className: css.track, "aria-hidden": "true", children: _jsx("span", { className: css.particleWindow, children: _jsx("span", { className: css.particles }) }) }), _jsxs("span", { className: css.thumb, "aria-hidden": "true", children: [_jsx("span", { className: css.exhaust }), _jsx(RocketLaunch, { size: 25, weight: "fill", className: css.rocket })] }), _jsx("input", { className: css.range, type: "range", min: 0, max: Math.max(effortChoices.length - 1, 0), step: 1, value: displayedEffortIndex, "aria-label": t('menu.effort'), "aria-valuetext": effortLabel, disabled: busy, onInput: (event) => { chooseEffort(Number(event.currentTarget.value)); } })] }), _jsx("div", { className: css.stops, children: effortChoices.map((choice, index) => _jsx("button", { type: "button", className: index === displayedEffortIndex ? css.stopActive : css.stop, "aria-pressed": index === displayedEffortIndex, disabled: busy, onClick: () => { chooseEffort(index); }, children: choice.label }, choice.key)) })] })] }), pane === 'models' && _jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: css.back, onClick: () => { setPane('root'); }, children: [_jsx(CaretLeft, { size: 14 }), _jsx("span", { children: t('menu.model') })] }), state.error !== null && _jsxs("div", { className: css.error, role: "alert", children: [_jsx("span", { children: t('error.action', { message: state.error }) }), _jsx("button", { type: "button", onClick: load, children: t('action.reload') })] }), _jsx("div", { className: css.groups, children: state.groups.length === 0
                                    ? _jsx("p", { className: css.empty, children: state.status === 'loading' ? t('status.loading') : t('empty.models') })
                                    : state.groups.map(group => _jsxs("section", { className: css.group, children: [_jsx("h3", { children: group.name }), group.models.map(model => {
                                                const choice = choices.find(candidate => candidate.group.id === group.id
                                                    && candidate.model.id === model.id);
                                                if (choice === undefined)
                                                    return null;
                                                const selected = state.current?.provider === group.id && state.current.model === model.id;
                                                return _jsxs("button", { type: "button", className: css.modelOption, "aria-pressed": selected, disabled: busy, onClick: () => { chooseModel(choice); }, children: [_jsx("span", { children: model.name }), selected && _jsx(Check, { size: 16, weight: "bold" })] }, model.id);
                                            })] }, group.id)) })] }), pane === 'root' && state.error !== null && _jsx("div", { className: css.error, role: "alert", children: _jsx("span", { children: t('error.action', { message: state.error }) }) })] })] });
}
//# sourceMappingURL=QuantSkillsGravityLaneModelSelect.js.map