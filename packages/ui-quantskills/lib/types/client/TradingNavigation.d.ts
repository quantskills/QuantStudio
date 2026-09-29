import './TradingWorkspace.css';
export declare function TradingSettingsNavigation<T extends string | number>({ current, items, onChange }: {
    current: T;
    items: readonly {
        id: T;
        title: string;
        detail: string;
    }[];
    onChange(value: T): void;
}): import("react").JSX.Element;
//# sourceMappingURL=TradingNavigation.d.ts.map