export class GardenRenderer {
    constructor(canvas: any);
    canvas: any;
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene<THREE.Object3DEventMap>;
    camera: THREE.PerspectiveCamera;
    texture: THREE.DataTexture;
    uniforms: {
        field: {
            value: THREE.DataTexture;
        };
        center: {
            value: THREE.Vector2;
        };
        dark: {
            value: number;
        };
        time: {
            value: number;
        };
    };
    targetCenter: THREE.Vector2;
    offset: THREE.Vector2;
    zoom: number;
    targetZoom: number;
    pointer: THREE.Vector2;
    group: THREE.Group<THREE.Object3DEventMap>;
    body: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial, THREE.Object3DEventMap>;
    shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial, THREE.Object3DEventMap>;
    environmentMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial, THREE.Object3DEventMap>;
    dust: THREE.Points<THREE.BufferGeometry<THREE.NormalBufferAttributes, THREE.BufferGeometryEventMap>, THREE.ShaderMaterial, THREE.Object3DEventMap>;
    rings: any[];
    raycaster: THREE.Raycaster;
    hitPlane: THREE.Plane;
    hit: THREE.Vector3;
    resizeObserver: ResizeObserver;
    resize(): void;
    width: any;
    height: any;
    update(texture: any, metrics: any): void;
    setTheme(dark: any): void;
    point(clientX: any, clientY: any): {
        u: number;
        v: number;
        x: number;
        y: number;
    } | null;
    ripple(x: any, y: any, kind: any): void;
    render(t: any, dt: any): void;
    dispose(): void;
    photo(): any;
}
import * as THREE from 'three';
//# sourceMappingURL=render.d.mts.map