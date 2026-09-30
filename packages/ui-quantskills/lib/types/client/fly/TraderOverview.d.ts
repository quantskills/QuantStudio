export type TraderActivity = {
    id: string | number;
    at: number;
    title: string;
    detail: string;
};
export declare function TraderOverview({ activities, onRecords, onManage }: {
    activities: TraderActivity[];
    onRecords: () => void;
    onManage: () => void;
}): import("react").JSX.Element;
//# sourceMappingURL=TraderOverview.d.ts.map