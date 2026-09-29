# Life garden in AI trader

The native LifeGarden component renders the local Lenia simulation in the AI trader Life tab. It uses the existing Three.js package; worker code and markup are included in the client bundle. No prototype server, CDN, account, Python runtime, Blender or model key is required.

The active tab owns the renderer, Worker and DOM listeners. On unmount it saves a checkpoint, stops the worker, cancels animation and releases WebGL resources. A subsequent mount waits for that save before loading. Hidden pages stop stepping; closed pages do not simulate offline growth.

IndexedDB `qs-life-garden-v1` stores named specimens and up to six snapshots in this browser origin. Prototype ports use separate browser storage. The simulation continues growth and responds to resources, flow and obstacles; genetic evolution across generations is not implemented.

The garden inherits QS theme tokens. Its styles and selectors are scoped to `#qs-life-garden`. Lenia patterns and rules credit Bert Chan, MIT; see `Lenia-LICENSE.md` and the package-level `LICENSE-LENIA.txt`.

Validation: `node packages/ui-quantskills/tests/life-garden-engine.check.mjs` plus the life-garden and fly Vitest tests. Browser QA must use the built QuantStudio client, including Life → Trade → Life, theme changes and snapshot restore.
