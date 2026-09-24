import { jsx as _jsx } from "react/jsx-runtime";
export default function FlyTable({ resizeStorageKey, ...props }) {
    return _jsx("div", { className: "fv-native-table", "data-table": resizeStorageKey, children: _jsx("table", { ...props }) });
}
//# sourceMappingURL=FlyTable.js.map