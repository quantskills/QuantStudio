import { LifeEngine } from './engine.mjs';
import { seeds } from './seeds.mjs';
let engine, paused = false, speed = 1, hidden = false, lastCheckpoint = 0;
function sendFrame() {
    const texture = new Float32Array(engine.len * 4);
    // Visual anti-aliasing only; saved state and future dynamics retain the unfiltered field.
    const n = engine.n, temp = new Float32Array(engine.len), weights = [1, 4, 6, 4, 1];
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++)
            for (let k = -2; k <= 2; k++)
                temp[y * n + x] += engine.a[y * n + (x + k + n) % n] * weights[k + 2] / 16;
    for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
            const i = y * n + x;
            for (let k = -2; k <= 2; k++)
                texture[i * 4] += temp[((y + k + n) % n) * n + x] * weights[k + 2] / 16;
            texture[i * 4 + 1] = engine.food[i];
            texture[i * 4 + 2] = engine.rocks[i];
            texture[i * 4 + 3] = 1;
        }
    postMessage({ type: 'frame', texture, metrics: engine.metrics() }, [texture.buffer]);
}
self.onmessage = ({ data: d }) => {
    try {
        if (d.type === 'init' || d.type === 'seed') {
            engine = new LifeEngine(seeds.find(s => s.id === d.seedId) || seeds.find(s => s.id === '3GH2s'));
            if (d.snapshot)
                engine.restore(d.snapshot);
            if (!d.snapshot)
                for (let i = 0; i < 60; i++)
                    engine.step();
            sendFrame();
            postMessage({ type: 'ready', seedId: engine.seedId });
        }
        else if (d.type === 'brush') {
            engine.brush(d.kind, d.u, d.v, d.dx, d.dy);
            sendFrame();
        }
        else if (d.type === 'pause')
            paused = d.value;
        else if (d.type === 'hidden')
            hidden = d.value;
        else if (d.type === 'speed')
            speed = d.value;
        else if (d.type === 'environment') {
            engine.environment = d.value;
            sendFrame();
        }
        else if (d.type === 'clear') {
            engine.clearEnvironment();
            sendFrame();
        }
        else if (d.type === 'snapshot')
            postMessage({ type: 'checkpoint', snapshot: engine.snapshot(), reason: d.reason });
    }
    catch (e) {
        postMessage({ type: 'error', message: e.message });
    }
};
setInterval(() => {
    if (!engine || paused || hidden)
        return;
    for (let i = 0; i < speed; i++)
        engine.step();
    sendFrame();
    if (Date.now() - lastCheckpoint > 8000) {
        lastCheckpoint = Date.now();
        postMessage({ type: 'checkpoint', snapshot: engine.snapshot(), reason: 'auto' });
    }
}, 50);
//# sourceMappingURL=simulation.worker.mjs.map