import type { ContestAccess } from '../contest.ts';
export declare function deliveryMonths(product: string, main: string): string[];
export declare function FlyInstrumentContract({ product, label, symbol, invalid, contest, accountKey, onSymbolChange }: {
    product: string;
    label: string;
    symbol: string;
    invalid: boolean;
    contest?: Pick<ContestAccess, 'query'> | undefined;
    accountKey: string;
    onSymbolChange: (value: string, onlyIfEmpty?: boolean) => void;
}): import("react").JSX.Element;
//# sourceMappingURL=FlyInstrumentContract.d.ts.map