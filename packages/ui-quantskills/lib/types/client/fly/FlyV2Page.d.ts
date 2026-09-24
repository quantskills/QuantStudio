import './fly-v2.css';
import type { ContestAccess } from '../contest.ts';
export default function FlyV2Page({ active, contest, openModelSettings, preparing, prepareMessage, onPrepare }: {
    active: boolean;
    contest?: Pick<ContestAccess, 'query' | 'status' | 'mode' | 'connect'> | undefined;
    openModelSettings?: (() => void) | undefined;
    preparing?: boolean;
    prepareMessage?: string | undefined;
    onPrepare?: ((blenderPath: string) => Promise<unknown>) | undefined;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyV2Page.d.ts.map
