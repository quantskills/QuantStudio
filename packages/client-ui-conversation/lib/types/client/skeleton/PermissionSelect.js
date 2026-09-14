import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { EyeIcon, KeyIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { IconChevronDownOutline14, Menu, RiskConfirmation } from '@deepseek-ai/dsh-client-ui-primitives';
import { en } from "../locales.js";
import css from './PermissionSelect.module.css';
const FULL_ACCESS = 'danger-full-access';
/** Distinct, familiar silhouettes make the three access scopes easy to scan. */
const permissionGlyphs = new Map([
    ['read-only', (_jsx("span", { className: clsx(css.modeIcon, css.readOnlyIcon), "aria-hidden": true, children: _jsx(EyeIcon, { size: 20, weight: "duotone" }) }))],
    ['workspace-write', (_jsx("span", { className: clsx(css.modeIcon, css.limitedIcon), "aria-hidden": true, children: _jsx(ShieldCheckIcon, { size: 20, weight: "duotone" }) }))],
    [FULL_ACCESS, (_jsx("span", { className: clsx(css.modeIcon, css.fullAccessIcon), "aria-hidden": true, children: _jsx(KeyIcon, { size: 20, weight: "duotone" }) }))],
]);
/** Glyph for a permission option value; host-configured names outside the design set get none. */
function permissionGlyph(value) {
    return permissionGlyphs.get(value);
}
/**
 * Display transform: built-in machine names render as locale product labels;
 * non-kebab host-configured names pass through.
 */
function displayName(name) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name))
        return name;
    return name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}
const BUILT_IN_PERMISSION_NAMES = new Map([
    ['read-only', en['access.preset.readOnly']],
    ['workspace-write', en['access.preset.workspaceWrite']],
    [FULL_ACCESS, en['access.preset.fullAccess']],
]);
function permissionLabel(value, name, t) {
    const builtInName = BUILT_IN_PERMISSION_NAMES.get(value);
    if (builtInName !== undefined && (name === value || name === builtInName)) {
        if (value === 'read-only')
            return t('access.preset.readOnly');
        if (value === 'workspace-write')
            return t('access.preset.workspaceWrite');
        if (value === FULL_ACCESS)
            return t('access.preset.fullAccess');
    }
    return displayName(name);
}
export function PermissionSelect({ value, locked, command, t }) {
    const [pick, setPick] = useState(null);
    const [open, setOpen] = useState(false);
    const [confirmation, setConfirmation] = useState(null);
    const [acknowledged, setAcknowledged] = useState(false);
    useEffect(() => {
        if (!locked && value !== undefined)
            return;
        setOpen(false);
        setAcknowledged(false);
        setConfirmation(null);
    }, [locked, value]);
    if (value === undefined)
        return null;
    const currentValue = pick ?? value.currentValue;
    const current = value.options.find(option => option.value === currentValue);
    const currentLabel = current === undefined
        ? permissionLabel(currentValue, currentValue, t)
        : permissionLabel(current.value, current.name, t);
    const busy = pick !== null || confirmation !== null;
    const items = value.options
        .filter(o => o.value !== 'custom')
        .map((option) => {
        const icon = permissionGlyph(option.value);
        return {
            id: option.value,
            label: permissionLabel(option.value, option.name, t),
            ...icon === undefined ? {} : { icon },
        };
    });
    const submit = (id) => {
        setPick(id);
        void command(`/permission ${id}`)
            .catch(() => false)
            .then(() => { setPick(null); });
    };
    const choose = (id) => {
        setOpen(false);
        if (id === value.currentValue)
            return;
        if (id === FULL_ACCESS) {
            setAcknowledged(false);
            setConfirmation(id);
            return;
        }
        submit(id);
    };
    const closeConfirmation = () => {
        setAcknowledged(false);
        setConfirmation(null);
    };
    const confirmFullAccess = () => {
        if (locked || !acknowledged || confirmation === null)
            return;
        const id = confirmation;
        closeConfirmation();
        submit(id);
    };
    return (_jsxs(_Fragment, { children: [_jsx(Menu, { open: open, items: items, selectedId: currentValue, onSelect: choose, onClose: () => { setOpen(false); }, side: "top", anchor: _jsxs("button", { type: "button", className: css.trigger, "aria-label": t('input.accessMode', { name: currentLabel }), title: current?.description, disabled: locked || busy, onClick: () => { setOpen(!open); }, children: [permissionGlyph(currentValue) !== undefined && (_jsx("span", { className: css.triggerIcon, "aria-hidden": true, children: permissionGlyph(currentValue) })), _jsx("span", { className: css.triggerLabel, children: currentLabel }), _jsx("span", { className: clsx(css.chevron, open && css.chevronOpen), "aria-hidden": true, children: _jsx(IconChevronDownOutline14, {}) })] }) }), _jsx(RiskConfirmation, { open: confirmation !== null, title: t('access.confirm.title'), description: t('access.confirm.description'), acknowledgeLabel: t('access.confirm.acknowledge'), cancelLabel: t('access.confirm.cancel'), closeLabel: t('close'), confirmLabel: t('access.confirm.enable'), acknowledged: acknowledged, disabled: locked, onAcknowledgedChange: setAcknowledged, onCancel: closeConfirmation, onConfirm: confirmFullAccess })] }));
}
//# sourceMappingURL=PermissionSelect.js.map