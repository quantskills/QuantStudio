import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import markup from './life-garden/garden.html?raw';
import { mountLifeGarden } from './life-garden/app.mjs';
import './life-garden/garden.css';
/** A local simulation. Mounting never connects a trading account or starts its runtime. */
export function LifeGarden() {
    const container = useRef(null);
    useEffect(() => {
        const root = container.current;
        if (!root)
            return;
        root.innerHTML = markup;
        const dispose = mountLifeGarden(root);
        return () => { dispose(); root.replaceChildren(); };
    }, []);
    return _jsx("div", { ref: container, id: "qs-life-garden", "aria-label": "\u751F\u547D\u82B1\u56ED" });
}
//# sourceMappingURL=LifeGarden.js.map