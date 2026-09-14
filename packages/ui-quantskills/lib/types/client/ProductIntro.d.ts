type Product = 'qube' | 'evo';
export declare const PRODUCT_URLS: {
    readonly qube: "https://www.pandaaiquant.com/agent_quant/";
    readonly evo: "https://www.pandaaiquant.com/evo/";
};
export declare function ProductIntro({ product, navigate }: {
    product: Product;
    navigate: (product: Product) => void;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=ProductIntro.d.ts.map