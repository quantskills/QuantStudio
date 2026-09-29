export class FFT2 {
    constructor(n: any);
    n: any;
    rev: Uint16Array<any>;
    cos: Float64Array<ArrayBuffer>;
    sin: Float64Array<ArrayBuffer>;
    line(re: any, im: any, offset: any, stride: any, inverse: any): void;
    run(re: any, im: any, inverse?: boolean): void;
}
export class LifeEngine {
    constructor(seed: any, n?: number);
    n: number;
    len: number;
    fft: FFT2;
    seedId: any;
    params: any;
    steps: number;
    environment: string;
    interactions: number;
    buildKernel(): void;
    sample(field: any, x: any, y: any): number;
    brush(kind: any, u: any, v: any, dx?: number, dy?: number): void;
    step(): void;
    clearEnvironment(): void;
    metrics(): {
        mass: number;
        active: number;
        center: number[];
        steps: number;
        interactions: number;
        environment: string;
    };
    snapshot(): {
        version: number;
        n: number;
        seedId: any;
        params: any;
        steps: number;
        environment: string;
        interactions: number;
        fields: {
            [k: string]: any[];
        };
    };
    restore(s: any): void;
}
//# sourceMappingURL=engine.d.mts.map