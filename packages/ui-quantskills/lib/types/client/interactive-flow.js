const RIPPLE_LIMIT = 8;
const rgb = (hex) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
const wrap = (value, size) => ((value % size) + size) % size;
/** Original procedural fields. Light scenes use pigment mixing, not additive lighting. */
const fragment = `
precision mediump float;
uniform vec2 resolution;
uniform vec3 motion;
uniform vec3 base;
uniform vec3 primary;
uniform vec3 secondary;
uniform vec3 tertiary;
uniform vec3 ink;
uniform vec3 pointer;
uniform vec4 rings[8];
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
  vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float field(vec2 p) {
  float n=0.,a=.5;
  for(int i=0;i<4;i++){ n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+2.7;a*=.48; }
  return n;
}
void main() {
  float time=motion.x,travel=motion.y,scene=motion.z;
  vec2 uv=gl_FragCoord.xy/resolution;
  vec2 aspect=vec2(resolution.x/resolution.y,1.);
  vec2 p=(uv-.5)*aspect;
  float t=time*.11;
  vec2 d=p-(pointer.xy-.5)*aspect;
  float touch=exp(-dot(d,d)*9.)*pointer.z;
  p+=d*touch*.22;
  float ripple=0.,bloom=0.;
  for(int i=0;i<8;i++){
    float age=rings[i].z;
    if(age<0.) continue;
    vec2 delta=p-(rings[i].xy-.5)*aspect;
    float dist=length(delta);
    float ring=exp(-pow((dist-age*.21)*22.,2.))*exp(-age*.8)*rings[i].w;
    p+=normalize(delta+vec2(.0001))*ring*.06;
    ripple+=ring;
    bloom+=exp(-dist*dist/(.006+age*.026))*exp(-age*.7)*rings[i].w;
  }
  vec2 q=vec2(p.x*1.3+p.y*.6,p.y*1.5-p.x*.45);
  q+=vec2(t*.19,travel*.00022-t*.1);
  vec2 warp=vec2(field(q+vec2(t*.12,0.)),field(q+vec2(4.8,-t*.08)));
  float cloud=field(q*1.6+warp*2.8);
  float ribbon=pow(.5+.5*sin(q.x*3.8+q.y*2.3+warp.x*6.+t),8.);
  float vein=pow(.5+.5*sin(q.x*7.+q.y*3.5+cloud*10.-t*.7),24.);
  vec3 col;
  if(scene<.5){
    vec3 hue=mix(primary,secondary,smoothstep(.3,.8,field(q+7.)));
    col=base+hue*(smoothstep(.18,.85,cloud)*.34+ribbon*.24);
    col+=mix(secondary,tertiary,warp.y)*vein*.075+hue*ripple*.10;
    col+=primary*touch*.055;
    col*=.84+.16*(1.-length(uv-.5));
  }else if(scene<1.5){
    // Shallow water: broad blue/teal refractions and thin moving caustics.
    float water=field(q*1.15+warp*2.+vec2(t*.08,-t*.12));
    float caustic=pow(1.-abs(sin(q.x*8.+q.y*5.+water*14.+t*.6)),12.);
    vec3 hue=mix(primary,secondary,smoothstep(.25,.75,water));
    col=mix(base,hue,.055+water*.19+ribbon*.045);
    col=mix(col,vec3(.99,1.,1.),caustic*.45+vein*.1);
    col=mix(col,primary,clamp(ripple*.1,0.,.18));
    col=mix(col,vec3(.99,1.,1.),touch*.22);
  }else if(scene<2.5){
    // Rainy glass: layered fog, with a cleared area following the pointer.
    float fog=field(q*1.2+vec2(t*.28,-t*.16));
    vec3 mist=mix(primary,secondary,warp.y);
    col=mix(base,mist,(.09+fog*.19+ribbon*.065)*(1.-touch*.35));
    col=mix(col,tertiary,vein*.035);
    col=mix(col,primary,clamp(ripple*.085+bloom*.045,0.,.25));
  }else{
    // Wet pigment gathers in distinct plumes; three ridges recede into paper mist.
    float pigment=smoothstep(.27,.68,field(q*1.2+warp*2.2));
    vec2 plumeCenter=vec2(-.32+sin(t*.17)*.12,.2+cos(t*.13)*.08);
    float plume=exp(-dot(p-plumeCenter,p-plumeCenter)*5.);
    plume+=exp(-dot(p-vec2(.57,-.02),p-vec2(.57,-.02))*7.)*.7;
    col=mix(base,ink,pigment*(.075+plume*.17));
    for(int j=0;j<3;j++){
      float depth=float(j);
      float peak=.19+depth*.3;
      float mountain=.32-depth*.085+sin(uv.x*6.+depth*1.8+t*.05)*.045;
      mountain+=exp(-pow((uv.x-peak)*3.7,2.))*.17;
      mountain+=field(vec2(uv.x*6.+t*.035,depth*2.+1.))*.115;
      float ridge=1.-smoothstep(mountain-.014,mountain+.012,uv.y);
      col=mix(col,ink,ridge*(.085+depth*.019));
      float mist=exp(-pow((uv.y-mountain+.045)*18.,2.));
      col=mix(col,base,mist*(.12+cloud*.12));
    }
    col=mix(col,secondary,ribbon*.035);
    col=mix(col,ink,clamp((bloom*.20+touch*.13)*(cloud+.55),0.,.30));
    col=mix(col,primary,clamp(ripple*.16,0.,.20));
    col+=(noise(gl_FragCoord.xy*.7)-.5)*.009;
  }
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
}`;
function fluid(canvas, theme) {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl)
        return undefined;
    const shaders = [];
    const compile = (kind, source) => {
        const shader = gl.createShader(kind);
        if (!shader)
            throw new Error('Fluid shader unavailable');
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error('Fluid shader unavailable');
        return shader;
    };
    const program = gl.createProgram();
    if (!program)
        return undefined;
    let buffer = null;
    const destroy = () => { for (const shader of shaders)
        gl.deleteShader(shader); gl.deleteProgram(program); if (buffer)
        gl.deleteBuffer(buffer); };
    try {
        gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}'));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error('Fluid program unavailable');
        gl.useProgram(program);
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const names = ['resolution', 'motion', 'base', 'primary', 'secondary', 'tertiary', 'ink', 'pointer', 'rings[0]'];
        const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, name)]));
        const sceneId = ['flow', 'lagoon', 'rain', 'ink'].indexOf(theme.scene);
        for (const [name, value] of [['base', theme.tokens.deep], ['primary', theme.tokens.accent], ['secondary', theme.tokens.agent], ['tertiary', theme.tokens.team], ['ink', theme.tokens.ink]]) {
            gl.uniform3fv(uniforms[name], name === 'primary' && theme.scene === 'flow' ? theme.glow.split(',').map(value => Number(value.trim()) / 255) : rgb(value));
        }
        const debug = gl.getExtension('WEBGL_debug_renderer_info');
        const software = debug && /swiftshader|llvmpipe|software/i.test(String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)));
        return {
            resize(width, height) {
                const ratio = Math.min(1, (software ? 720 : 1200) / Math.max(width, height));
                canvas.width = Math.max(1, Math.round(width * ratio));
                canvas.height = Math.max(1, Math.round(height * ratio));
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
            },
            draw(time, x, y, active, travel, ripples) {
                gl.uniform3f(uniforms.motion, time, travel, sceneId);
                gl.uniform3f(uniforms.pointer, x, 1 - y, active);
                gl.uniform4fv(uniforms['rings[0]'], new Float32Array(Array.from({ length: RIPPLE_LIMIT }, (_, i) => {
                    const r = ripples[i];
                    return r ? [r.x, 1 - r.y, time - r.born, r.strength] : [0, 0, -100, 0];
                }).flat()));
                gl.drawArrays(gl.TRIANGLES, 0, 3);
            },
            destroy,
        };
    }
    catch {
        destroy();
        return undefined;
    }
}
/** Passive observers add decoration without intercepting application controls. */
export function createInteractiveFlow(layer, canvas, theme) {
    const context = canvas.getContext('2d');
    const gpu = document.createElement('canvas');
    gpu.setAttribute('aria-hidden', 'true');
    layer.prepend(gpu);
    let shader = fluid(gpu, theme);
    layer.dataset.flowRenderer = shader ? 'webgl' : 'canvas';
    layer.dataset.flowScene = theme.scene;
    if (!shader)
        gpu.hidden = true;
    let width = 1, height = 1, time = 0, enabled = false, disposed = false, painted = false, scroll = 0, smoothScroll = 0;
    const pointer = { x: .65, y: .3, targetX: .65, targetY: .3, strength: 0, inside: false };
    const trail = { x: 0, y: 0, born: -1 };
    const ripples = [];
    const particles = Array.from({ length: 100 }, (_, i) => ({ x: ((i * 137.51) % 997) / 997, y: ((i * 237.71) % 991) / 991, speed: .4 + (i % 7) * .12, size: .5 + (i % 4) * .35 }));
    const scene = theme.scene, light = theme.scheme === 'light';
    const colors = scene === 'ink' ? [theme.tokens.ink, theme.tokens.secondary, theme.tokens.accent] : [theme.tokens.accent, theme.tokens.agent, theme.tokens.team, theme.tokens.ink];
    const addRipple = (x, y, strength) => {
        ripples.push({ x, y, born: time, strength });
        if (ripples.length > RIPPLE_LIMIT)
            ripples.shift();
    };
    const coords = (event) => {
        const rect = layer.getBoundingClientRect();
        return { x: (event.clientX - rect.left) / (rect.width || width), y: (event.clientY - rect.top) / (rect.height || height) };
    };
    const move = (event) => {
        if (!enabled || disposed || event.pointerType === 'touch')
            return;
        const { x, y } = coords(event);
        pointer.targetX = x;
        pointer.targetY = y;
        pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
        if (scene !== 'flow' && pointer.inside && time - trail.born >= .14 && Math.hypot((x - trail.x) * width, (y - trail.y) * height) > 18) {
            addRipple(x, y, .34);
            trail.x = x;
            trail.y = y;
            trail.born = time;
        }
    };
    const leave = () => { pointer.inside = false; };
    const click = (event) => {
        if (!enabled || disposed || event.button !== 0)
            return;
        const { x, y } = coords(event);
        if (x < 0 || x > 1 || y < 0 || y > 1)
            return;
        pointer.targetX = x;
        pointer.targetY = y;
        pointer.inside = true;
        addRipple(x, y, 1);
    };
    const onScroll = (event) => {
        if (!enabled)
            return;
        const target = event.target;
        if (target instanceof Element && (target.closest('[aria-label="QuantSkills 插件应用"]') || target.hasAttribute('data-conversation-scroll')))
            scroll = target.scrollTop;
    };
    let repaint = () => { };
    const lost = (event) => { event.preventDefault(); shader?.destroy(); shader = undefined; gpu.hidden = true; layer.dataset.flowRenderer = 'canvas'; repaint(); };
    gpu.addEventListener('webglcontextlost', lost);
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerdown', click, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    document.addEventListener('scroll', onScroll, { capture: true, passive: true });
    const wash = (x, y, radius, color, alpha) => {
        if (!context)
            return;
        const gradient = context.createRadialGradient(x, y, 0, x, y, Math.max(1, radius));
        gradient.addColorStop(0, color);
        gradient.addColorStop(.45, color);
        gradient.addColorStop(1, 'transparent');
        context.globalAlpha = alpha;
        context.fillStyle = gradient;
        context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    };
    const fallback = () => {
        if (!context)
            return;
        context.globalAlpha = 1;
        context.fillStyle = theme.tokens.deep;
        context.fillRect(0, 0, width, height);
        if (scene === 'ink') {
            for (let j = 0; j < 3; j++) {
                const x = width * (.08 + j * .39 + Math.sin(time * .025 + j) * .06), y = height * (.24 + Math.sin(j * 2 + time * .04) * .12);
                for (let lobe = 0; lobe < 4; lobe++) {
                    const angle = lobe * 1.7 + j + time * .035;
                    wash(x + Math.cos(angle) * width * .035, y + Math.sin(angle) * height * .055, Math.min(width, height) * (.18 + lobe * .025), theme.tokens.ink, .04 + lobe * .004);
                }
            }
            // Separate ridge edges and bands of paper-coloured mist keep the layers legible.
            for (let j = 0; j < 3; j++) {
                context.globalAlpha = .085 + j * .025;
                context.fillStyle = theme.tokens.ink;
                context.beginPath();
                context.moveTo(-20, height);
                for (let x = -20; x < width + 40; x += 20) {
                    const u = x / width, peak = .19 + j * .3;
                    const y = height * (.62 + j * .085 - Math.exp(-Math.pow((u - peak) * 3.7, 2)) * .17) - Math.sin(u * 6 + j * 1.8 + time * .0055) * height * .045 - Math.sin(u * 17 + j) * height * .019;
                    context.lineTo(x, y);
                }
                context.lineTo(width + 40, height);
                context.closePath();
                context.fill();
                for (let cloud = 0; cloud < 3; cloud++)
                    wash(width * (.15 + cloud * .4 + Math.sin(time * .025 + j) * .04), height * (.64 + j * .085), width * .25, theme.tokens.deep, .075);
            }
        }
        else {
            for (let j = 0; j < 4; j++) {
                const x = width * (.18 + j * .24 + Math.sin(time * .045 + j) * .12), y = height * (.4 + Math.sin(time * .055 + j * 2) * .32);
                wash(x, y, width * .43, colors[j % 3], scene === 'lagoon' ? .065 : scene === 'rain' ? .09 : .065);
            }
        }
        if (scene === 'rain')
            return;
        context.lineCap = 'round';
        for (let j = 0; j < (scene === 'ink' ? 3 : 6); j++) {
            context.strokeStyle = scene === 'ink' ? theme.tokens.ink : colors[j % 3];
            context.lineWidth = scene === 'lagoon' ? 1.5 + j * .7 : 45 + j * 14;
            context.globalAlpha = scene === 'lagoon' ? .075 : scene === 'ink' ? .032 : .025;
            context.beginPath();
            for (let x = -80; x < width + 80; x += 24) {
                const y = height * (.1 + j * .17) + Math.sin(x / width * 4 + time * .12 + j) * height * .13 - smoothScroll * .025;
                if (x === -80)
                    context.moveTo(x, y);
                else
                    context.lineTo(x, y);
            }
            context.stroke();
        }
    };
    const rain = () => {
        if (!context)
            return;
        const px = pointer.x * width, py = pointer.y * height;
        // Far fine rain, near bright streaks, then slow drops on the glass surface.
        for (let i = 0; i < 128; i++) {
            const p = particles[i % particles.length], front = i % 4 === 0;
            const x = wrap(p.x * width - time * (front ? 30 : 14), width), y = wrap(p.y * height + time * (front ? 260 : 145) * p.speed, height);
            const clear = Math.max(0, 1 - Math.hypot(x - px, y - py) / 160) * pointer.strength;
            context.strokeStyle = front ? theme.tokens.ink : theme.tokens.accent;
            context.globalAlpha = (front ? .19 : .10) * (1 - clear * .88);
            context.lineWidth = front ? 1 : .65;
            context.beginPath();
            context.moveTo(x, y);
            context.lineTo(x - 3 - (front ? 3 : 0), y + 12 + (front ? 19 : 0));
            context.stroke();
        }
        for (let i = 0; i < 18; i++) {
            const p = particles[i * 5], x = p.x * width + Math.sin(time * .15 + i) * 2, y = wrap(p.y * height + time * (2 + i % 3), height);
            const clear = Math.max(0, 1 - Math.hypot(x - px, y - py) / 140) * pointer.strength;
            const size = 1.4 + (i % 4) * .5;
            context.strokeStyle = theme.tokens.ink;
            context.globalAlpha = .18 * (1 - clear * .9);
            context.lineWidth = .7;
            context.beginPath();
            context.ellipse(x, y, size, size * (1.2 + i % 3 * .4), -.16, 0, Math.PI * 2);
            context.stroke();
            context.fillStyle = theme.tokens.ink;
            context.globalAlpha *= .75;
            context.beginPath();
            context.arc(x - size * .35, y - size * .5, .55, 0, Math.PI * 2);
            context.fill();
        }
    };
    const renderer = {
        setActive(active) {
            enabled = active;
            if (!active) {
                pointer.inside = false;
                pointer.strength = 0;
                ripples.length = 0;
                trail.born = -1;
            }
        },
        resize(w, h) { width = Math.max(1, w); height = Math.max(1, h); shader?.resize(width, height); },
        draw(now) {
            if (disposed)
                return;
            if (enabled || !painted)
                time = now;
            painted = true;
            if (enabled) {
                pointer.x += (pointer.targetX - pointer.x) * .065;
                pointer.y += (pointer.targetY - pointer.y) * .065;
                pointer.strength += ((pointer.inside ? 1 : 0) - pointer.strength) * .06;
                smoothScroll += (scroll - smoothScroll) * .045;
            }
            while (ripples[0] && time - ripples[0].born > 4)
                ripples.shift();
            shader?.draw(time, pointer.x, pointer.y, pointer.strength, smoothScroll, ripples);
            if (!context)
                return;
            context.clearRect(0, 0, width, height);
            if (!shader)
                fallback();
            if (scene === 'rain')
                rain();
            const near = [];
            for (let i = 0; i < (scene === 'flow' ? 100 : scene === 'ink' ? 38 : 58); i++) {
                const p = particles[i];
                let x = wrap(p.x * width + time * p.speed * (scene === 'ink' ? 2 : 6), width);
                let y = wrap(p.y * height - time * p.speed * (scene === 'rain' ? 7 : 3) - smoothScroll * .035, height);
                const dx = x - pointer.x * width, dy = y - pointer.y * height, d = Math.hypot(dx, dy);
                const force = Math.max(0, 1 - d / 190) * pointer.strength;
                x += (dx * .12 - dy * .18) * force;
                y += (dy * .12 + dx * .18) * force;
                context.fillStyle = colors[i % colors.length];
                context.globalAlpha = (light ? .10 : .12) + (light ? .19 : .38) * (.5 + .5 * Math.sin(time * p.speed + i)) + force * .25;
                context.beginPath();
                context.arc(x, y, p.size * (scene === 'ink' ? .75 : 1) + force * .7, 0, Math.PI * 2);
                context.fill();
                if (scene === 'flow' && force > .1)
                    near.push({ x, y });
                if (scene === 'flow' && i % 23 === 0) {
                    context.globalAlpha *= .55;
                    context.fillRect(x - 3, y - .4, 6, .8);
                    context.fillRect(x - .4, y - 3, .8, 6);
                }
            }
            context.lineWidth = .6;
            context.strokeStyle = theme.tokens.agent;
            for (let i = 0; i < near.length; i++)
                for (let j = i + 1; j < near.length; j++) {
                    const a = near[i], b = near[j], d = Math.hypot(a.x - b.x, a.y - b.y);
                    if (d > 100)
                        continue;
                    context.globalAlpha = (1 - d / 100) * .28 * pointer.strength;
                    context.beginPath();
                    context.moveTo(a.x, a.y);
                    context.lineTo(b.x, b.y);
                    context.stroke();
                }
            if (!shader && pointer.strength > .01) {
                wash(pointer.x * width, pointer.y * height, 160, scene === 'ink' ? theme.tokens.ink : theme.tokens.accent, pointer.strength * (scene === 'ink' ? .10 : .05));
            }
            for (const r of ripples) {
                const age = time - r.born, radius = 12 + age * Math.min(width, height) * .24;
                if (scene === 'ink')
                    wash(r.x * width, r.y * height, 28 + age * 55, theme.tokens.ink, Math.exp(-age) * .15 * r.strength);
                context.strokeStyle = theme.tokens.accent;
                context.lineWidth = scene === 'ink' ? 1 : 1.1;
                context.globalAlpha = Math.exp(-age * 1.2) * (scene === 'ink' ? .52 : light ? .36 : .55) * r.strength;
                context.beginPath();
                context.arc(r.x * width, r.y * height, radius, 0, Math.PI * 2);
                context.stroke();
                context.strokeStyle = scene === 'lagoon' ? theme.tokens.agent : theme.tokens.team;
                context.globalAlpha *= .45;
                context.beginPath();
                context.arc(r.x * width, r.y * height, radius * .82, 0, Math.PI * 2);
                context.stroke();
            }
            const phase = (time + 4) % 17;
            if (scene === 'flow' && phase < 2.4) {
                const x = width * (.12 + phase * .38), y = height * (.08 + phase * .12);
                const trail = context.createLinearGradient(x - 100, y - 30, x, y);
                trail.addColorStop(0, 'transparent');
                trail.addColorStop(.7, theme.tokens.agent);
                trail.addColorStop(1, theme.tokens.ink);
                context.globalAlpha = Math.sin(phase / 2.4 * Math.PI) * .65;
                context.strokeStyle = trail;
                context.lineWidth = 1.4;
                context.beginPath();
                context.moveTo(x - 100, y - 30);
                context.lineTo(x, y);
                context.stroke();
            }
            context.globalAlpha = 1;
        },
        destroy() {
            if (disposed)
                return;
            disposed = true;
            enabled = false;
            ripples.length = 0;
            shader?.destroy();
            gpu.remove();
            gpu.removeEventListener('webglcontextlost', lost);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerdown', click);
            document.documentElement.removeEventListener('pointerleave', leave);
            document.removeEventListener('scroll', onScroll, true);
        },
    };
    repaint = () => renderer.draw(time);
    return renderer;
}
//# sourceMappingURL=interactive-flow.js.map