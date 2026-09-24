import type { ContestAccess } from '../contest.ts';
export type FlyInstrument = {
    product: string;
    symbol: string;
    exchange: string;
};
export declare function FlyInstruments({ instruments, contest, accountKey, invalid, onChange }: {
    instruments: FlyInstrument[];
    contest: Pick<ContestAccess, 'query' | 'watch'> | undefined;
    accountKey: string;
    invalid: boolean;
    onChange: (items: FlyInstrument[] | ((current: FlyInstrument[]) => FlyInstrument[])) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyInstruments.d.ts.map