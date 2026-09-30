import type { ReactNode } from 'react';
declare const icons: {
    market: import("@phosphor-icons/react").Icon;
    plans: import("@phosphor-icons/react").Icon;
    account: import("@phosphor-icons/react").Icon;
};
export declare function TraderDisclosure({ kind, title, description, status, tone, open, id, children }: {
    kind: keyof typeof icons;
    title: string;
    description: string;
    status: ReactNode;
    tone?: 'neutral' | 'ready' | 'attention';
    open?: boolean | undefined;
    id?: string | undefined;
    children: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=TraderDisclosure.d.ts.map