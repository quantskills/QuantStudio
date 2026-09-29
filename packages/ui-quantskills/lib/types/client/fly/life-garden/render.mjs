import * as THREE from 'three';
const shared = `
uniform sampler2D field; uniform vec2 center; uniform float dark;
varying vec2 vUv; varying vec3 vPos;
vec4 state(vec2 uv){return texture2D(field,fract(uv+center-0.5));}
float density(vec2 uv){return state(uv).r;}
float heightAt(vec2 uv){float a=density(uv);return pow(max(a-0.016,0.0),0.58)*0.95;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
`;
export class GardenRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
        this.renderer.setClearColor(0, 0);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
        this.camera.position.set(0, -6.3, 14.4);
        this.camera.lookAt(0, 0, 0);
        this.texture = new THREE.DataTexture(new Float32Array(128 * 128 * 4), 128, 128, THREE.RGBAFormat, THREE.FloatType);
        this.texture.minFilter = THREE.LinearFilter;
        this.texture.magFilter = THREE.LinearFilter;
        this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
        this.uniforms = { field: { value: this.texture }, center: { value: new THREE.Vector2(.5, .5) }, dark: { value: 0 }, time: { value: 0 } };
        this.targetCenter = new THREE.Vector2(.5, .5);
        this.offset = new THREE.Vector2();
        this.zoom = 1;
        this.targetZoom = 1;
        this.pointer = new THREE.Vector2(-10, -10);
        this.group = new THREE.Group();
        this.scene.add(this.group);
        const geometry = new THREE.PlaneGeometry(11, 11, 319, 319);
        const vertex = `${shared}
    void main(){vUv=uv;vec3 p=position;p.z=heightAt(uv);vPos=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`;
        const fragment = `${shared}
    void main(){
      float a=density(vUv);if(a<0.018)discard;
      float eps=1.0/450.0;
      float hx=heightAt(vUv+vec2(eps,0.0))-heightAt(vUv-vec2(eps,0.0));
      float hy=heightAt(vUv+vec2(0.0,eps))-heightAt(vUv-vec2(0.0,eps));
      vec3 normal=normalize(vec3(-hx,-hy,eps*22.0));
      vec3 light=normalize(vec3(-0.7,0.6,1.0));vec3 view=normalize(vec3(0.0,-0.45,1.0));
      float diff=dot(normal,light)*0.5+0.5;
      float fres=pow(1.0-max(dot(normal,view),0.0),2.6);
      float spec=pow(max(dot(reflect(-light,normal),view),0.0),45.0);
      float ribbon=sin(a*31.0+vUv.x*14.0-vUv.y*8.0)*0.5+0.5;
      float hue=sin(vUv.x*12.0+vUv.y*9.0+a*2.7)*.5+.5;
      vec3 jade=mix(vec3(.27,.66,.64),vec3(.20,.68,.64),dark);
      vec3 lavender=mix(vec3(.57,.57,.77),vec3(.55,.45,.78),dark);
      vec3 pigment=mix(jade,lavender,smoothstep(.38,.91,hue));
      pigment=mix(pigment,vec3(.83,.69,.59),pow(1.0-hue,5.0)*.50);
      vec3 col=mix(pigment,vec3(.93,.96,.93),.16+diff*.24);
      col*=.66+diff*.39;
      col=mix(col,pigment,.24*smoothstep(.05,.55,a));
      col+=vec3(.66,.81,.82)*spec*.50;
      col+=fres*mix(vec3(.43,.74,.71),vec3(.5,.73,.83),hue)*.32;
      float ridge=pow(ribbon,22.0)*.042;
      col+=ridge;
      float grain=hash(floor(vUv*1150.0));
      col+=(grain-.5)*.033;
      float membrane=smoothstep(.016,.12,a)*(1.0-smoothstep(.12,.42,a));
      col=mix(col,vec3(.87,.96,.94),membrane*.38);
      col=mix(col,col*.83+pigment*.16,dark);
      float opacity=smoothstep(.018,.10,a)*(.84+spec*.12);
      gl_FragColor=vec4(col,opacity);
    }`;
        this.body = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, side: THREE.DoubleSide, depthWrite: true }));
        this.group.add(this.body);
        const flat = `varying vec2 vUv; varying vec3 vPos;void main(){vUv=uv;vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
        const shadowFrag = `${shared}void main(){float d=0.0;for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){d+=density(vUv+vec2(float(x),float(y))*.004+vec2(.009,-.012))/25.0;}gl_FragColor=vec4(mix(vec3(.20,.42,.44),vec3(.03,.07,.1),dark),smoothstep(.015,.6,d)*mix(.16,.45,dark));}`;
        this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: flat, fragmentShader: shadowFrag, transparent: true, depthWrite: false }));
        this.shadow.position.z = -.09;
        this.group.add(this.shadow);
        const environmentFrag = `${shared}void main(){vec4 s=state(vUv);float food=s.g,rock=s.b;if(food<.018&&rock<.01)discard;vec3 col=mix(vec3(.47,.73,.60),vec3(.41,.84,.73),dark);float alpha=food*.42;if(rock>.01){col=mix(vec3(.55,.63,.67),vec3(.36,.48,.55),dark);alpha=rock*.7;}gl_FragColor=vec4(col,alpha);}`;
        this.environmentMesh = new THREE.Mesh(new THREE.PlaneGeometry(11, 11), new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: flat, fragmentShader: environmentFrag, transparent: true, depthWrite: false }));
        this.environmentMesh.position.z = -.02;
        this.group.add(this.environmentMesh);
        // Ambient dust is decoration only. Organism geometry above always follows the simulation field.
        const positions = new Float32Array(240 * 3), sizes = new Float32Array(240);
        let random = 731;
        const rand = () => { random = (1664525 * random + 1013904223) >>> 0; return random / 4294967296; };
        for (let i = 0; i < 240; i++) {
            positions[i * 3] = (rand() - .5) * 13;
            positions[i * 3 + 1] = (rand() - .5) * 10;
            positions[i * 3 + 2] = rand() * 1.5 - .6;
            sizes[i] = 1 + rand() * 2.5;
        }
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        pg.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        this.dust = new THREE.Points(pg, new THREE.ShaderMaterial({ uniforms: this.uniforms, transparent: true, depthWrite: false, vertexShader: `uniform float time;attribute float size;void main(){vec3 p=position;p.x+=sin(time*.08+position.y)*.055;p.y+=cos(time*.07+position.x)*.05;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);gl_PointSize=size;}`, fragmentShader: `uniform float dark;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(mix(vec3(.36,.60,.59),vec3(.49,.76,.77),dark),(1.0-smoothstep(.1,.5,d))*.26);}` }));
        this.group.add(this.dust);
        this.rings = [];
        this.raycaster = new THREE.Raycaster();
        this.hitPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        this.hit = new THREE.Vector3();
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(canvas.parentElement);
        this.resize();
    }
    resize() { const r = this.canvas.parentElement.getBoundingClientRect(); this.width = r.width; this.height = r.height; this.renderer.setSize(r.width, r.height, false); this.camera.aspect = r.width / r.height; this.camera.updateProjectionMatrix(); }
    update(texture, metrics) { this.texture.image.data = texture; this.texture.needsUpdate = true; if (metrics.mass > 1)
        this.targetCenter.set(...metrics.center); }
    setTheme(dark) { this.uniforms.dark.value = dark ? 1 : 0; }
    point(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect(), p = new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -((clientY - rect.top) / rect.height * 2 - 1));
        this.raycaster.setFromCamera(p, this.camera);
        if (!this.raycaster.ray.intersectPlane(this.hitPlane, this.hit))
            return null;
        const u = this.hit.x / 11 + .5 + this.uniforms.center.value.x - .5, v = this.hit.y / 11 + .5 + this.uniforms.center.value.y - .5;
        return { u: (u + 10) % 1, v: (v + 10) % 1, x: this.hit.x, y: this.hit.y };
    }
    ripple(x, y, kind) {
        const color = kind === 'food' ? 0x72b5a2 : kind === 'rock' ? 0x8296a0 : 0x98b7d4;
        const mesh = new THREE.Mesh(new THREE.RingGeometry(.08, .087, 80), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false }));
        mesh.position.set(x, y, .045);
        this.scene.add(mesh);
        this.rings.push({ mesh, age: 0 });
    }
    render(t, dt) {
        this.uniforms.time.value = t;
        const c = this.uniforms.center.value, goal = this.targetCenter;
        for (const axis of ['x', 'y']) {
            let d = goal[axis] + this.offset[axis] - c[axis];
            d -= Math.round(d);
            c[axis] = (c[axis] + d * Math.min(1, dt * 3) + 1) % 1;
        }
        this.zoom += (this.targetZoom - this.zoom) * Math.min(1, dt * 7);
        const mobile = this.width < 600, dist = (mobile ? 1.34 : 1) / this.zoom;
        this.camera.position.set(0, -6.3 * dist, 14.4 * dist);
        this.camera.lookAt(0, -.50, 0);
        this.camera.updateMatrixWorld();
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            r.age += dt;
            r.mesh.scale.setScalar(1 + r.age * 14);
            r.mesh.material.opacity = Math.max(0, .48 - r.age * .48);
            if (r.age > 1) {
                this.scene.remove(r.mesh);
                r.mesh.geometry.dispose();
                r.mesh.material.dispose();
                this.rings.splice(i, 1);
            }
        }
        this.renderer.render(this.scene, this.camera);
    }
    dispose() {
        this.resizeObserver.disconnect();
        this.scene.traverse(object => { object.geometry?.dispose(); const materials = object.material ? (Array.isArray(object.material) ? object.material : [object.material]) : []; materials.forEach(material => material.dispose()); });
        this.texture.dispose();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
    }
    photo() { return this.canvas.toDataURL('image/png'); }
}
//# sourceMappingURL=render.mjs.map