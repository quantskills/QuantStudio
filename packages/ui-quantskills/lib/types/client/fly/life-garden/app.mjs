import { GardenRenderer } from './render.mjs';
import { seeds } from './seeds.mjs';
import engineSource from './engine.mjs?raw';
import seedSource from './seeds.mjs?raw';
import workerSource from './simulation.worker.mjs?raw';
let pendingShutdown = Promise.resolve();
/** @param {HTMLElement} root @returns {() => void} */
export function mountLifeGarden(root) {
    let disposed = false, raf = 0, workerUrl = '', finishShutdown;
    const events = new AbortController();
    const listen = (element, type, handler, options = {}) => element.addEventListener(type, handler, typeof options === 'boolean' ? { capture: options, signal: events.signal } : { ...options, signal: events.signal });
    const $ = id => root.querySelector(`[id="${id}"]`);
    const paths = { sun: 'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', camera: 'M4 6h4l2-2h4l2 2h4v14H4z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0', expand: 'M4 9V4h5m6 0h5v5M4 15v5h5m6 0h5v-5', plus: 'M12 5v14M5 12h14', minus: 'M5 12h14', focus: 'M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0', close: 'm6 6 12 12M6 18 18 6', chevron: 'm7 10 5 5 5-5', check: 'm5 12 4 4L19 6', sparkle: 'm12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4z', wind: 'M3 8h12c5 0 5-6 1-6M3 12h16c4 0 4 6 0 6M3 16h7c4 0 4 6 0 6', stone: 'm4 8 6-4 8 2 3 9-5 5H7L2 15z', hand: 'M8 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-4a2 2 0 0 1 4 0v8c0 5-4 7-8 7-3 0-5-3-7-6l-2-3c-1-2 2-3 3-1l2 2', waves: 'M2 6c4-5 6 5 10 0s6 5 10 0M2 12c4-5 6 5 10 0s6 5 10 0M2 18c4-5 6 5 10 0s6 5 10 0', orbit: 'M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M3 20 21 4M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0', pause: 'M8 5v14M16 5v14', play: 'm8 5 11 7-11 7z' };
    function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.orbit}"/></svg>`; }
    function icons() { root.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon)); }
    icons();
    let toastTimer;
    function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2400); }
    const choices = [{ id: '3GH2s', name: '澄光', description: '柔软的群落，缓缓舒展' }, { id: 'O2u', name: '游弋', description: '一枚小小的、会移动的细胞' }, { id: 'OG2g', name: '回旋', description: '两个空腔，绕着彼此转动' }];
    let config = { seedId: '3GH2s', theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light', names: {}, speed: 1 }, tool = 'food', paused = false, metrics = null, lastSnapshot = null, moments = [], db, renderer, worker, ready = false;
    let down = false, lastPointer = null, lastBrush = 0, previousFocus = null, frameNumber = 0;
    async function storage() { return new Promise((resolve, reject) => { const r = indexedDB.open('qs-life-garden-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('garden'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
    function get(key) { if (!db)
        return Promise.resolve(null); return new Promise((resolve, reject) => { const r = db.transaction('garden').objectStore('garden').get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
    function put(key, value) { if (!db)
        return Promise.resolve(); return new Promise((resolve, reject) => { const tx = db.transaction('garden', 'readwrite'); tx.objectStore('garden').put(value, key); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); }); }
    function saveConfig() { put('config', config).catch(() => toast('本次设置尚未保存')); }
    function updateName() { const c = choices.find(c => c.id === config.seedId); const name = config.names[config.seedId] || c?.name || '生命'; $('life-name').textContent = name; $('name-input').value = name; $('species-id').textContent = config.seedId; }
    function drawSeed(seed) {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        const rows = seed.cells, h = rows.length, w = rows[0].length, scale = Math.min(130 / w, 96 / h);
        ctx.translate((160 - w * scale) / 2, (120 - h * scale) / 2);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const a = rows[y][x];
                if (a < .02)
                    continue;
                ctx.fillStyle = `rgba(${Math.round(66 + a * 34)},${Math.round(125 + a * 45)},${Math.round(139 + a * 30)},${a * .85 + .1})`;
                ctx.fillRect(x * scale, y * scale, scale + .2, scale + .2);
            }
        return canvas.toDataURL();
    }
    function specimenList() {
        $('specimen-list').replaceChildren();
        for (const choice of choices) {
            const button = document.createElement('button');
            button.className = 'specimen' + (choice.id === config.seedId ? ' active' : '');
            button.dataset.seed = choice.id;
            button.setAttribute('aria-pressed', String(choice.id === config.seedId));
            const img = new Image();
            img.src = drawSeed(seeds.find(s => s.id === choice.id));
            img.alt = '';
            const text = document.createElement('span'), strong = document.createElement('strong'), small = document.createElement('small');
            strong.textContent = config.names[choice.id] || choice.name;
            small.textContent = choice.description;
            text.append(strong, small);
            button.append(img, text);
            if (choice.id === config.seedId) {
                const i = document.createElement('i');
                i.innerHTML = icon('check');
                button.append(i);
            }
            button.onclick = () => switchSeed(choice.id);
            $('specimen-list').append(button);
        }
    }
    function closePop() { for (const id of ['environment-pop', 'interaction-pop'])
        $(id).hidden = true; $('interaction-toggle').setAttribute('aria-expanded', 'false'); $('environment-toggle').setAttribute('aria-expanded', 'false'); }
    function togglePop(id, button) { const was = $(id).hidden; closePop(); $(id).hidden = !was; button.setAttribute('aria-expanded', String(was)); }
    function openDrawer() { closePop(); previousFocus = document.activeElement; $('life-drawer').hidden = false; $('scrim').hidden = false; specimenList(); renderMoments(); $('close-drawer').focus(); }
    function closeDrawer() { $('life-drawer').hidden = true; $('scrim').hidden = true; previousFocus?.focus(); }
    function setTool(value) { tool = value; $('viewport').dataset.tool = value; const labels = { food: ['轻点', '在它身旁，撒一点养分。'], flow: ['拖动', '画一道水流，看它怎样舒展。'], rock: ['轻点', '放一块石头，改变它的小世界。'], look: ['拖动', '换个位置看看。滚轮可以靠近。'] }; const [key, text] = labels[value]; $('hint').querySelector('.hint-key').textContent = key; $('hint-text').textContent = text; $('tool-icon').innerHTML = icon({ food: 'sparkle', flow: 'wind', rock: 'stone', look: 'hand' }[value]); root.querySelectorAll('[data-tool]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.tool === value))); closePop(); }
    function setPaused(value) { paused = value; worker?.postMessage({ type: 'pause', value }); $('pause').innerHTML = icon(value ? 'play' : 'pause'); $('pause').setAttribute('aria-label', value ? '继续生长' : '暂停生长'); updateMetrics(); if (value)
        worker.postMessage({ type: 'snapshot', reason: 'pause' }); }
    function updateMetrics() { if (!metrics)
        return; const env = metrics.environment === 'current' ? '缓流' : '静水'; $('live-status').textContent = paused ? '已暂停' : metrics.mass < 1 ? '生命已消散' : `正在生长 · ${env}`; $('environment-label').textContent = env + ' · 珠光'; $('step-value').textContent = metrics.steps.toLocaleString(); $('mass-value').textContent = metrics.mass.toFixed(1); $('interaction-value').textContent = metrics.interactions; $('empty-state').hidden = metrics.mass >= 1; root.querySelectorAll('[data-env]').forEach(e => e.classList.toggle('selected', e.dataset.env === metrics.environment)); }
    async function switchSeed(id) {
        if (id === config.seedId)
            return;
        worker.postMessage({ type: 'snapshot', reason: 'switch' });
        const snap = await get('life:' + id);
        config.seedId = id;
        lastSnapshot = null;
        updateName();
        saveConfig();
        worker.postMessage({ type: 'seed', seedId: id, snapshot: snap });
        renderer.offset.set(0, 0);
        renderer.targetZoom = id === '3GH2s' ? 1 : 1.65;
        closeDrawer();
        toast(snap ? '继续这个生命上次的旅程' : '一个新的小生命，开始生长');
    }
    function photo() {
        const image = document.createElement('canvas');
        image.width = renderer.canvas.width;
        image.height = renderer.canvas.height;
        const ctx = image.getContext('2d');
        ctx.fillStyle = config.theme === 'dark' ? '#101e2a' : '#f4f8f7';
        ctx.fillRect(0, 0, image.width, image.height);
        ctx.drawImage(renderer.canvas, 0, 0);
        return image;
    }
    function renderMoments() {
        const box = $('moments');
        box.replaceChildren();
        if (!moments.length) {
            const p = document.createElement('p');
            p.className = 'empty-copy';
            p.textContent = '喜欢的形态，可以留在这里。';
            box.append(p);
            return;
        }
        for (const moment of moments) {
            const b = document.createElement('button');
            b.className = 'moment';
            b.setAttribute('aria-label', '回到快照 ' + moment.name);
            const img = new Image();
            img.src = moment.image;
            img.alt = '';
            const text = document.createElement('span'), strong = document.createElement('strong'), small = document.createElement('small');
            strong.textContent = moment.name;
            small.textContent = new Date(moment.date).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' · 点击回到此刻';
            text.append(strong, small);
            b.append(img, text);
            b.onclick = async () => { worker.postMessage({ type: 'snapshot', reason: 'switch' }); config.seedId = moment.snapshot.seedId; updateName(); saveConfig(); worker.postMessage({ type: 'seed', seedId: config.seedId, snapshot: moment.snapshot }); closeDrawer(); toast('已从这张快照继续生长'); };
            box.append(b);
        }
    }
    function storeMoment(snapshot) { const full = photo(), thumb = document.createElement('canvas'); thumb.width = 360; thumb.height = Math.round(full.height / full.width * 360); thumb.getContext('2d').drawImage(full, 0, 0, thumb.width, thumb.height); moments.unshift({ name: $('life-name').textContent, date: Date.now(), image: thumb.toDataURL('image/jpeg', .84), snapshot }); moments = moments.slice(0, 6); put('moments', moments).then(() => { renderMoments(); toast('已留下这一刻，可以随时回来'); }).catch(() => toast('快照未能保存，请检查设备存储')); }
    function restart() { worker.postMessage({ type: 'seed', seedId: config.seedId }); renderer.offset.set(0, 0); closeDrawer(); toast('已回到这个种子的出生时'); }
    async function init() {
        await pendingShutdown;
        if (disposed)
            return;
        try {
            db = await storage();
            config = { ...config, ...await get('config') };
            moments = await get('moments') || [];
        }
        catch {
            $('save-status').textContent = '存储不可用 · 本次生长不会自动保存';
        }
        if (disposed) {
            db?.close();
            return;
        }
        syncTheme();
        updateName();
        try {
            renderer = new GardenRenderer($('life-canvas'));
            renderer.setTheme(config.theme === 'dark');
            renderer.targetZoom = config.seedId === '3GH2s' ? 1 : 1.65;
        }
        catch (e) {
            $('loading').textContent = '此设备暂时无法启动 WebGL。请尝试开启浏览器硬件加速。';
            console.error(e);
            return;
        }
        workerUrl = URL.createObjectURL(new Blob([[engineSource.replace(/\bexport\s+/g, ''), seedSource.replace(/\bexport\s+/g, ''), workerSource.replace(/^import .*;\s*$/gm, '')].join('\n')], { type: 'text/javascript' }));
        worker = new Worker(workerUrl);
        worker.onerror = e => { $('loading').hidden = false; $('loading').textContent = '生命计算未能启动，请刷新重试。'; console.error(e.message); };
        worker.onmessage = async ({ data: d }) => {
            if (disposed && d.type !== 'checkpoint')
                return;
            if (d.type === 'frame') {
                metrics = d.metrics;
                renderer.update(d.texture, metrics);
                updateMetrics();
                frameNumber++;
                root.dataset.steps = String(metrics.steps);
                root.dataset.frame = String(frameNumber);
            }
            else if (d.type === 'ready') {
                ready = true;
                $('loading').hidden = true;
                root.dataset.ready = 'true';
            }
            else if (d.type === 'checkpoint') {
                lastSnapshot = d.snapshot;
                try {
                    await put('life:' + d.snapshot.seedId, d.snapshot);
                    if (db && !disposed)
                        $('save-status').textContent = '已保存 · 此设备';
                    if (d.reason === 'moment' && !disposed)
                        storeMoment(d.snapshot);
                }
                catch {
                    if (!disposed)
                        $('save-status').textContent = '未保存 · 设备存储不足';
                }
                finally {
                    if (d.reason === 'dispose')
                        finishShutdown?.();
                }
            }
            else if (d.type === 'error')
                toast(d.message);
        };
        const snapshot = await get('life:' + config.seedId);
        if (disposed)
            return;
        worker.postMessage({ type: 'init', seedId: config.seedId, snapshot });
        worker.postMessage({ type: 'hidden', value: document.hidden });
        worker.postMessage({ type: 'speed', value: config.speed });
        $('speed').textContent = config.speed + '×';
        const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce)
            setPaused(true);
        let lastTime = performance.now(), hidden = document.hidden;
        function frame(time) { if (disposed)
            return; const dt = Math.min((time - lastTime) / 1000, .05); lastTime = time; if (!hidden)
            renderer.render(time / 1000, dt); raf = requestAnimationFrame(frame); }
        raf = requestAnimationFrame(frame);
        listen(document, 'visibilitychange', () => { hidden = document.hidden; worker.postMessage({ type: 'hidden', value: hidden }); if (hidden)
            worker.postMessage({ type: 'snapshot', reason: 'hidden' }); });
    }
    $('fullscreen').onclick = () => { if (document.fullscreenElement)
        document.exitFullscreen();
    else
        root.requestFullscreen?.().catch(() => toast('可以使用浏览器全屏查看')); };
    $('capture').onclick = () => { if (!ready)
        return; const a = document.createElement('a'); a.download = '生命花园-' + $('life-name').textContent + '.png'; a.href = photo().toDataURL('image/png'); a.click(); toast('已保存一张生命照片'); };
    $('interaction-toggle').onclick = e => togglePop('interaction-pop', e.currentTarget);
    $('environment-toggle').onclick = e => togglePop('environment-pop', e.currentTarget);
    root.querySelectorAll('[data-close-pop]').forEach(b => b.onclick = closePop);
    root.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => setTool(b.dataset.tool));
    root.querySelectorAll('[data-env]').forEach(b => b.onclick = () => { worker.postMessage({ type: 'environment', value: b.dataset.env }); closePop(); toast(b.dataset.env === 'still' ? '水流慢下来，继续自由生长' : '缓流正在轻轻改变这个世界'); });
    $('clear-environment').onclick = () => { worker.postMessage({ type: 'clear' }); toast('已清除养分、水流扰动与石头'); closePop(); };
    $('my-life').onclick = openDrawer;
    $('close-drawer').onclick = closeDrawer;
    $('scrim').onclick = closeDrawer;
    $('save-name').onclick = () => { const name = $('name-input').value.trim(); if (!name) {
        toast('给它一个名字吧');
        return;
    } config.names[config.seedId] = name; updateName(); saveConfig(); specimenList(); toast('就叫它「' + name + '」'); };
    $('pause').onclick = () => setPaused(!paused);
    $('speed').onclick = () => { config.speed = config.speed === 1 ? 2 : config.speed === 2 ? 3 : 1; $('speed').textContent = config.speed + '×'; worker.postMessage({ type: 'speed', value: config.speed }); saveConfig(); };
    $('zoom-in').onclick = () => renderer.targetZoom = Math.min(2.5, renderer.targetZoom * 1.2);
    $('zoom-out').onclick = () => renderer.targetZoom = Math.max(.65, renderer.targetZoom / 1.2);
    $('recenter').onclick = () => { renderer.offset.set(0, 0); renderer.targetZoom = config.seedId === '3GH2s' ? 1 : 1.65; };
    $('save-moment').onclick = () => worker.postMessage({ type: 'snapshot', reason: 'moment' });
    $('restart').onclick = restart;
    $('restore-birth').onclick = restart;
    $('feed-near').onclick = () => { if (!metrics)
        return; worker.postMessage({ type: 'brush', kind: 'food', u: (metrics.center[0] + .11) % 1, v: metrics.center[1] }); renderer.ripple(1.2, 0, 'food'); toast('养分已撒下，留意附近的变化'); closePop(); };
    const canvas = $('life-canvas');
    listen(root, 'click', e => {
        if (!ready && e.target.closest('button') && !e.target.closest('#theme,#fullscreen')) {
            e.preventDefault();
            e.stopImmediatePropagation();
            toast('正在唤醒生命，请稍等一下');
        }
    }, true);
    function brush(e) {
        if (!ready || !renderer)
            return;
        const now = performance.now();
        if (now - lastBrush < 35)
            return;
        lastBrush = now;
        const p = renderer.point(e.clientX, e.clientY);
        if (!p)
            return;
        if (tool === 'look' && lastPointer) {
            renderer.offset.x -= (e.clientX - lastPointer.clientX) / renderer.width * .65;
            renderer.offset.y += (e.clientY - lastPointer.clientY) / renderer.height * .65;
        }
        else {
            const wrapped = d => d - Math.round(d);
            const dx = lastPointer?.p ? wrapped(p.u - lastPointer.p.u) : 0, dy = lastPointer?.p ? wrapped(p.v - lastPointer.p.v) : 0;
            worker.postMessage({ type: 'brush', kind: tool, u: p.u, v: p.v, dx, dy });
            if (now - (brush.lastRipple || 0) > 160) {
                renderer.ripple(p.x, p.y, tool);
                brush.lastRipple = now;
            }
        }
        lastPointer = { clientX: e.clientX, clientY: e.clientY, p };
    }
    listen(canvas, 'pointerdown', e => { closePop(); down = true; lastPointer = null; canvas.setPointerCapture(e.pointerId); brush(e); });
    listen(canvas, 'pointermove', e => { if (down)
        brush(e); });
    listen(canvas, 'pointerup', () => { down = false; lastPointer = null; });
    listen(canvas, 'pointercancel', () => { down = false; lastPointer = null; });
    listen(canvas, 'wheel', e => { e.preventDefault(); if (renderer)
        renderer.targetZoom = Math.min(2.5, Math.max(.65, renderer.targetZoom * Math.exp(-e.deltaY * .001))); }, { passive: false });
    listen(document, 'pointerdown', e => { if (!root.contains(e.target) || !e.target.closest('.dock-wrap'))
        closePop(); });
    listen(document, 'keydown', e => {
        if (e.key === 'Escape') {
            closePop();
            if (!$('life-drawer').hidden)
                closeDrawer();
        }
        if (e.key === 'Tab' && !$('life-drawer').hidden) {
            const focusable = [...$('life-drawer').querySelectorAll('button,input,a,summary')].filter(el => el.getClientRects().length);
            const first = focusable[0], last = focusable.at(-1);
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            }
            else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'SUMMARY', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable && ready && root.contains(document.activeElement)) {
            e.preventDefault();
            setPaused(!paused);
        }
    });
    init().catch(e => { if (disposed)
        return; $('loading').textContent = '这个小世界暂时未能启动，请刷新重试。'; console.error(e); });
    // Read the resolved QS theme: every ancestor may carry a preset or system theme.
    function syncTheme() {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;color:var(--fv-panel)';
        root.append(probe);
        const rgb = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) || [255, 255, 255];
        probe.remove();
        const dark = rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 < 140;
        config.theme = dark ? 'dark' : 'light';
        root.dataset.theme = config.theme;
        renderer?.setTheme(dark);
    }
    const themeObserver = new MutationObserver(syncTheme);
    for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement)
        themeObserver.observe(ancestor, { attributes: true });
    const colorScheme = window.matchMedia?.('(prefers-color-scheme: dark)');
    colorScheme?.addEventListener('change', syncTheme);
    return () => {
        disposed = true;
        events.abort();
        themeObserver.disconnect();
        colorScheme?.removeEventListener('change', syncTheme);
        cancelAnimationFrame(raf);
        clearTimeout(toastTimer);
        renderer?.dispose();
        if (!worker) {
            db?.close();
            return;
        }
        pendingShutdown = new Promise(resolve => {
            let settled = false;
            const timeout = setTimeout(() => finish(), 1000);
            function finish() { if (settled)
                return; settled = true; clearTimeout(timeout); worker.terminate(); URL.revokeObjectURL(workerUrl); db?.close(); resolve(); }
            finishShutdown = finish;
            worker.postMessage({ type: 'pause', value: true });
            worker.postMessage({ type: 'snapshot', reason: 'dispose' });
        });
    };
}
//# sourceMappingURL=app.mjs.map