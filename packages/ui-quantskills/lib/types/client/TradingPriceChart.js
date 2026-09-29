import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useId, useRef, useState } from 'react';
/** Draw only received prices, sized to the panel so labels remain readable. */
export function TradingPriceChart({ prices, times, label }) {
    const ref = useRef(null), fill = `price-${useId().replaceAll(':', '')}`;
    const [width, setWidth] = useState(640);
    useEffect(() => {
        const element = ref.current;
        if (!element || typeof ResizeObserver === 'undefined')
            return;
        const observer = new ResizeObserver(([entry]) => { if (entry && entry.contentRect.width > 0)
            setWidth(entry.contentRect.width); });
        observer.observe(element);
        return () => observer.disconnect();
    }, []);
    const samples = prices.map((price, index) => ({ price, time: times?.[index] })).filter(sample => Number.isFinite(sample.price));
    const values = samples.map(sample => sample.price);
    if (!values.length)
        return null;
    const low = Math.min(...values), high = Math.max(...values);
    const padding = (high - low || Math.max(Math.abs(high) * .0001, 1)) * .16;
    const minimum = low - padding, maximum = high + padding;
    const right = Math.max(80, width - 72), bottom = 194;
    const firstTime = samples[0].time, lastTime = samples.at(-1).time;
    const timed = firstTime != null && lastTime != null && lastTime > firstTime && samples.every(sample => Number.isFinite(sample.time));
    const points = samples.map((sample, i) => ({ x: 4 + (timed ? (sample.time - firstTime) / (lastTime - firstTime) : i / Math.max(1, values.length - 1)) * (right - 4), y: bottom - (sample.price - minimum) / (maximum - minimum) * 178 }));
    const path = points.map((point, i) => `${i ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
    const last = points.at(-1);
    return _jsxs("svg", { ref: ref, viewBox: `0 0 ${width} 210`, className: "qs-price-chart", role: "img", "aria-label": label, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: fill, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "var(--qs-accent)", stopOpacity: ".13" }), _jsx("stop", { offset: "1", stopColor: "var(--qs-accent)", stopOpacity: "0" })] }) }), [.15, .5, .85].map(ratio => _jsxs("g", { children: [_jsx("line", { x1: "4", x2: right, y1: 16 + ratio * 178, y2: 16 + ratio * 178 }), _jsx("text", { x: width - 2, y: 20 + ratio * 178, textAnchor: "end", children: (maximum - ratio * (maximum - minimum)).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) })] }, ratio)), points.length > 1 && _jsxs(_Fragment, { children: [_jsx("path", { d: `${path}L${last.x},${bottom}H4Z`, fill: `url(#${fill})` }), _jsx("path", { className: "qs-price-line", d: path })] }), _jsx("circle", { cx: last.x, cy: last.y, r: "3.5", fill: "var(--qs-accent)", children: _jsxs("title", { children: ["\u6700\u65B0 ", values.at(-1)] }) })] });
}
//# sourceMappingURL=TradingPriceChart.js.map