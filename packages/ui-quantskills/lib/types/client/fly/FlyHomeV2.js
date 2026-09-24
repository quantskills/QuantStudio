import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { flyAsset } from "./transport.js";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
export default function FlyHomeV2({ body, version, paused }) {
    const host = useRef(null);
    const latest = useRef({ body, paused });
    latest.current = { body, paused };
    const [error, setError] = useState('');
    const [ready, setReady] = useState(false);
    const [preview, setPreview] = useState();
    useEffect(() => { let active = true; void flyAsset(version, 'preview.png').then(url => { if (active)
        setPreview(url); }).catch(() => { }); return () => { active = false; }; }, [version]);
    const reset = useRef(() => { });
    useEffect(() => {
        if (!host.current)
            return;
        const element = host.current;
        setError('');
        setReady(false);
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        }
        catch {
            setError('3D 暂不可用，家园仍在后台运行');
            return;
        }
        renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2;
        element.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(36, 1, .05, 90);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.minDistance = 3;
        controls.maxDistance = 22;
        controls.maxPolarAngle = Math.PI / 2.04;
        reset.current = () => { camera.position.set(8, 8, 10); controls.target.set(0, .5, 0); controls.update(); };
        reset.current();
        scene.add(new THREE.HemisphereLight(0xfff5d9, 0x334f4a, 3));
        const sun = new THREE.DirectionalLight(0xffebc6, 4);
        sun.position.set(-3, 8, 5);
        scene.add(sun);
        const fly = new THREE.Group();
        fly.position.fromArray(latest.current.body.position);
        scene.add(fly);
        const chitin = new THREE.MeshStandardMaterial({ color: 0x37464c, roughness: .5, metalness: .15 });
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xc86648, roughness: .5 });
        const wingMat = new THREE.MeshPhysicalMaterial({ color: 0xe9f3f0, transparent: true, opacity: .55, roughness: .2, side: THREE.DoubleSide });
        function sphere(material, scale, position) {
            const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), material);
            mesh.scale.fromArray(scale);
            mesh.position.fromArray(position);
            fly.add(mesh);
            return mesh;
        }
        sphere(chitin, [.12, .10, .20], [0, 0, 0]);
        sphere(chitin, [.115, .105, .1], [0, .035, -.20]);
        sphere(eyeMat, [.065, .075, .07], [-.073, .06, -.23]);
        sphere(eyeMat, [.065, .075, .07], [.073, .06, -.23]);
        const left = sphere(wingMat, [.21, .015, .12], [-.17, .10, .02]);
        const right = sphere(wingMat, [.21, .015, .12], [.17, .10, .02]);
        for (const side of [-1, 1])
            for (let i = 0; i < 3; i++) {
                const leg = new THREE.Mesh(new THREE.CylinderGeometry(.009, .009, .2, 5), chitin);
                leg.position.set(side * .12, -.08, (i - 1) * .09);
                leg.rotation.z = side * .7;
                fly.add(leg);
            }
        let disposed = false;
        const leaves = [];
        const dew = new THREE.Group();
        scene.add(dew);
        const dewMaterial = new THREE.MeshStandardMaterial({ color: 0xbbddcc, metalness: .25, roughness: .2 });
        for (let i = 0; i < 25; i++) {
            const drop = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), dewMaterial);
            drop.position.set(Math.sin(i * 2.4) * 2.9, .27, Math.cos(i * 1.7) * 1.9);
            dew.add(drop);
        }
        const foodMarkers = (latest.current.body.food || []).map(food => {
            const material = new THREE.MeshBasicMaterial({ color: 0xffb654, transparent: true, opacity: .85 });
            const marker = new THREE.Mesh(new THREE.TorusGeometry(.24, .018, 6, 32), material);
            marker.rotation.x = Math.PI / 2;
            marker.position.fromArray(food.position);
            scene.add(marker);
            return { id: food.id, marker, material };
        });
        const wind = new THREE.Group();
        scene.add(wind);
        for (let i = 0; i < 16; i++) {
            const dash = new THREE.Mesh(new THREE.BoxGeometry(.22, .009, .009), new THREE.MeshBasicMaterial({ color: 0xc9e7ce, transparent: true, opacity: .5 }));
            dash.position.set((i % 4) - 2, .5 + (i % 3) * .35, Math.floor(i / 4) - 1.5);
            wind.add(dash);
        }
        function dispose(root) {
            root.traverse(o => { if (o instanceof THREE.Mesh) {
                o.geometry.dispose();
                (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { Object.values(m).forEach(v => { if (v instanceof THREE.Texture)
                    v.dispose(); }); m.dispose(); });
            } });
        }
        void flyAsset(version, 'home.glb').then(url => {
            if (disposed)
                return;
            new GLTFLoader().load(url, gltf => {
                if (disposed) {
                    dispose(gltf.scene);
                    return;
                }
                gltf.scene.traverse(o => { if (/FlyRoot|Placeholder.chart/.test(o.name))
                    o.visible = false; if (/leaf/i.test(o.name))
                    leaves.push({ object: o, angle: o.rotation.z }); });
                scene.add(gltf.scene);
                setReady(true);
            }, undefined, () => { if (!disposed)
                setError('家园模型加载失败，请恢复上一个版本'); });
        }).catch(() => { if (!disposed)
            setError('家园模型读取失败'); });
        const resize = new ResizeObserver(() => {
            const { width, height } = element.getBoundingClientRect();
            if (!width || !height)
                return;
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        resize.observe(element);
        const clock = new THREE.Clock();
        const target = new THREE.Vector3();
        let frame = 0;
        let phase = 0;
        function draw() {
            frame = requestAnimationFrame(draw);
            const dt = Math.min(.1, clock.getDelta());
            const current = latest.current;
            target.fromArray(current.body.position);
            const delta = target.clone().sub(fly.position);
            if (delta.length() > .015)
                fly.rotation.y = Math.atan2(-delta.x, -delta.z);
            if (current.body.controller && current.body.yaw != null)
                fly.rotation.y = -current.body.yaw;
            fly.position.lerp(target, 1 - Math.exp(-dt * 7));
            const moving = !current.paused && ['flying', 'turning', 'avoiding'].includes(current.body.action);
            if (!current.paused)
                phase += dt * (moving ? 85 : 2);
            left.rotation.z = Math.sin(phase) * (moving ? .6 : .04);
            right.rotation.z = -left.rotation.z;
            if (current.body.action === 'eating' && !current.paused)
                fly.rotation.x = Math.sin(phase * 2) * .12;
            else
                fly.rotation.x = 0;
            sun.intensity = { quiet: 1.7, daylight: 5, breeze: 3.4, dew: 2.8 }[current.body.event] || 4;
            sun.color.setHex({ quiet: 0xabbcdd, daylight: 0xffdb9d, breeze: 0xd6f1e5, dew: 0xbad9ed }[current.body.event] || 0xffebc6);
            dew.visible = current.body.event === 'dew';
            wind.visible = current.body.event === 'breeze';
            wind.position.x = Math.sin(clock.elapsedTime * .9) * .5;
            leaves.forEach((leaf, index) => { leaf.object.rotation.z = leaf.angle + (current.body.event === 'breeze' ? Math.sin(clock.elapsedTime * 1.4 + index) * .10 : 0); });
            foodMarkers.forEach(item => { const available = current.body.food?.find(f => f.id === item.id)?.available; item.material.color.setHex(available ? 0xffb654 : 0x6c7a76); item.material.opacity = available ? .75 + .2 * Math.sin(clock.elapsedTime * 2) : .2; });
            controls.update();
            if (!document.hidden)
                renderer.render(scene, camera);
        }
        ;
        draw();
        return () => { disposed = true; cancelAnimationFrame(frame); resize.disconnect(); controls.dispose(); dispose(scene); renderer.dispose(); renderer.domElement.remove(); };
    }, [version]);
    return _jsxs("div", { className: "fv-home-canvas", children: [(!ready || error) && _jsx("img", { className: "fv-home-preview", src: preview, alt: "\u5BB6\u56ED\u9884\u89C8" }), _jsx("div", { className: "fv-three", ref: host }), _jsx("div", { className: "fv-scene-caption", children: error || (ready ? '拖动环顾 · 滚轮缩放 · 身体状态来自后台' : '正在进入家园…') }), _jsxs("div", { className: "fv-world-notices", children: [body.effect && (body.effect_remaining || 0) > 0 && _jsxs("div", { className: "fv-effect-result", role: "status", children: ["Jev \u5DF2\u6267\u884C \u00B7 ", { daylight: '日光变亮', breeze: '微风与叶片摆动', quiet: '灯光调暗，安静休息', dew: '露水已出现', replenish: '果实已补充' }[body.effect.event], _jsxs("small", { children: ["\u53D8\u5316\u63D0\u793A ", Math.ceil(body.effect_remaining || 0), " \u79D2"] })] }), body.wait_reason && _jsxs("div", { className: "fv-wait-reason", role: "status", children: [body.wait_reason.message, body.wait_reason.recovery_seconds != null && _jsxs("small", { children: ["\u7EA6 ", body.wait_reason.recovery_seconds, " \u79D2\u540E\u6210\u719F \u00B7 \u73AF\u5883\u81EA\u52A8\u6062\u590D"] })] })] }), _jsx("button", { type: "button", className: "fv-camera", onClick: () => reset.current(), children: "\u91CD\u7F6E\u89C6\u89D2" })] });
}
//# sourceMappingURL=FlyHomeV2.js.map