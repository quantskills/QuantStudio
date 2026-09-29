// Continuous Lenia dynamics. Original FFT and environment integration for the life garden.
// Specimens and mathematical rules: Bert Chan / Lenia, MIT (Lenia-LICENSE.md).
export class FFT2 {
    constructor(n) {
        this.n = n;
        this.rev = new Uint16Array(n);
        this.cos = new Float64Array(n / 2);
        this.sin = new Float64Array(n / 2);
        const bits = Math.log2(n);
        if (!Number.isInteger(bits))
            throw new Error('FFT size must be a power of two');
        for (let i = 0; i < n; i++) {
            let x = i, r = 0;
            for (let b = 0; b < bits; b++) {
                r = (r << 1) | (x & 1);
                x >>= 1;
            }
            this.rev[i] = r;
        }
        for (let i = 0; i < n / 2; i++) {
            this.cos[i] = Math.cos(2 * Math.PI * i / n);
            this.sin[i] = Math.sin(2 * Math.PI * i / n);
        }
    }
    line(re, im, offset, stride, inverse) {
        const n = this.n;
        for (let i = 0; i < n; i++) {
            const j = this.rev[i];
            if (j > i) {
                const a = offset + i * stride, b = offset + j * stride;
                [re[a], re[b]] = [re[b], re[a]];
                [im[a], im[b]] = [im[b], im[a]];
            }
        }
        for (let len = 2; len <= n; len *= 2) {
            const half = len / 2, skip = n / len;
            for (let i = 0; i < n; i += len)
                for (let j = 0; j < half; j++) {
                    const a = offset + (i + j) * stride, b = offset + (i + j + half) * stride, k = j * skip;
                    const wr = this.cos[k], wi = this.sin[k] * (inverse ? 1 : -1), tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
                    re[b] = re[a] - tr;
                    im[b] = im[a] - ti;
                    re[a] += tr;
                    im[a] += ti;
                }
        }
        if (inverse)
            for (let i = 0; i < n; i++) {
                re[offset + i * stride] /= n;
                im[offset + i * stride] /= n;
            }
    }
    run(re, im, inverse = false) { for (let y = 0; y < this.n; y++)
        this.line(re, im, y * this.n, 1, inverse); for (let x = 0; x < this.n; x++)
        this.line(re, im, x, this.n, inverse); }
}
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export class LifeEngine {
    constructor(seed, n = 128) {
        this.n = n;
        this.len = n * n;
        this.fft = new FFT2(n);
        for (const key of ['a', 'food', 'vx', 'vy', 'rocks', 'next', 're', 'im', 'kr', 'ki'])
            this[key] = new Float64Array(this.len);
        this.seedId = seed.id;
        this.params = structuredClone(seed.params);
        this.steps = 0;
        this.environment = 'still';
        this.interactions = 0;
        const cells = seed.cells, ox = Math.floor((n - cells[0].length) / 2), oy = Math.floor((n - cells.length) / 2);
        for (let y = 0; y < cells.length; y++)
            for (let x = 0; x < cells[y].length; x++)
                this.a[(y + oy) * n + x + ox] = cells[y][x];
        this.buildKernel();
    }
    buildKernel() {
        const { R, b, kn } = this.params, n = this.n;
        let sum = 0;
        this.ki.fill(0);
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const dx = x <= n / 2 ? x : x - n, dy = y <= n / 2 ? y : y - n, r = Math.hypot(dx, dy) / R, br = r * b.length, f = br % 1;
                const core = kn === 2 ? (f > 0 && f < 1 ? Math.exp(4 - 1 / (f * (1 - f))) : 0) : Math.pow(4 * f * (1 - f), 4);
                const v = r < 1 ? core * b[Math.min(Math.floor(br), b.length - 1)] : 0;
                this.kr[y * n + x] = v;
                sum += v;
            }
        for (let i = 0; i < this.len; i++)
            this.kr[i] /= sum;
        this.fft.run(this.kr, this.ki);
    }
    sample(field, x, y) {
        const n = this.n;
        x = (x % n + n) % n;
        y = (y % n + n) % n;
        const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        const jx = (ix + 1) % n, jy = (iy + 1) % n;
        return field[iy * n + ix] * (1 - fx) * (1 - fy) + field[iy * n + jx] * fx * (1 - fy) + field[jy * n + ix] * (1 - fx) * fy + field[jy * n + jx] * fx * fy;
    }
    brush(kind, u, v, dx = 0, dy = 0) {
        const n = this.n, cx = u * n, cy = v * n, r = kind === 'rock' ? 3.2 : 8;
        for (let y = Math.floor(cy - r * 2); y <= cy + r * 2; y++)
            for (let x = Math.floor(cx - r * 2); x <= cx + r * 2; x++) {
                const d2 = (x - cx) ** 2 + (y - cy) ** 2;
                if (d2 > r * r * 4)
                    continue;
                const i = ((y % n + n) % n) * n + (x % n + n) % n, w = Math.exp(-d2 / (r * r * .55));
                if (kind === 'food')
                    this.food[i] = clamp(this.food[i] + w * .45);
                else if (kind === 'flow') {
                    this.vx[i] = clamp(this.vx[i] + dx * n * w * .65, -.65, .65);
                    this.vy[i] = clamp(this.vy[i] + dy * n * w * .65, -.65, .65);
                }
                else if (kind === 'rock')
                    this.rocks[i] = Math.max(this.rocks[i], w > .22 ? 1 : 0);
            }
        this.interactions++;
    }
    step() {
        const n = this.n, { m, s, T, gn } = this.params;
        this.re.set(this.a);
        this.im.fill(0);
        this.fft.run(this.re, this.im);
        for (let i = 0; i < this.len; i++) {
            const r = this.re[i] * this.kr[i] - this.im[i] * this.ki[i];
            this.im[i] = this.re[i] * this.ki[i] + this.im[i] * this.kr[i];
            this.re[i] = r;
        }
        this.fft.run(this.re, this.im, true);
        for (let i = 0; i < this.len; i++) {
            const u = this.re[i], q = (u - m) / s;
            const growth = gn === 2 ? 2 * Math.exp(-q * q / 2) - 1 : 2 * Math.pow(Math.max(0, 1 - q * q / 9), 4) - 1;
            // Added resources slightly modulate existing growth; they cannot spawn a cell from nothing.
            const nutrient = this.food[i] * this.a[i] * (1 - this.a[i]) * .22;
            this.next[i] = clamp(this.a[i] + (growth + nutrient) / T) * (1 - this.rocks[i]);
            this.food[i] *= Math.max(0, .998 - this.a[i] * .035);
        }
        const current = this.environment === 'current' ? .045 : 0;
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const i = y * n + x, dx = this.vx[i] + current * Math.sin(y * .06 + this.steps * .001), dy = this.vy[i];
                this.a[i] = (Math.abs(dx) + Math.abs(dy) > 1e-5 ? this.sample(this.next, x - dx, y - dy) : this.next[i]) * (1 - this.rocks[i]);
                this.vx[i] *= .96;
                this.vy[i] *= .96;
            }
        this.steps++;
    }
    clearEnvironment() { this.food.fill(0); this.vx.fill(0); this.vy.fill(0); this.rocks.fill(0); }
    metrics() {
        const n = this.n;
        let mass = 0, sx = 0, cx = 0, sy = 0, cy = 0, active = 0;
        for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++) {
                const a = this.a[y * n + x];
                if (a > .03)
                    active++;
                mass += a;
                sx += a * Math.sin(x / n * 2 * Math.PI);
                cx += a * Math.cos(x / n * 2 * Math.PI);
                sy += a * Math.sin(y / n * 2 * Math.PI);
                cy += a * Math.cos(y / n * 2 * Math.PI);
            }
        return { mass, active, center: [((Math.atan2(sx, cx) / (2 * Math.PI)) + 1) % 1, ((Math.atan2(sy, cy) / (2 * Math.PI)) + 1) % 1], steps: this.steps, interactions: this.interactions, environment: this.environment };
    }
    snapshot() { return { version: 1, n: this.n, seedId: this.seedId, params: structuredClone(this.params), steps: this.steps, environment: this.environment, interactions: this.interactions, fields: Object.fromEntries(['a', 'food', 'vx', 'vy', 'rocks'].map(k => [k, Array.from(this[k])])) }; }
    restore(s) {
        if (s.version !== 1 || s.n !== this.n || !s.fields)
            throw new Error('不兼容的生命存档');
        for (const key of ['a', 'food', 'vx', 'vy', 'rocks']) {
            const field = s.fields[key];
            if (!Array.isArray(field) || field.length !== this.len || field.some(v => !Number.isFinite(v)))
                throw new Error('生命存档不完整');
        }
        this.params = structuredClone(s.params);
        this.seedId = s.seedId;
        this.steps = s.steps;
        this.environment = s.environment;
        this.interactions = s.interactions || 0;
        for (const key of ['a', 'food', 'vx', 'vy', 'rocks'])
            this[key].set(s.fields[key]);
        this.buildKernel();
    }
}
//# sourceMappingURL=engine.mjs.map