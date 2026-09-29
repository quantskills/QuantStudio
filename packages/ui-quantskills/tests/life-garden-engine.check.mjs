import assert from 'node:assert/strict';
import {LifeEngine,FFT2} from '../src/client/fly/life-garden/engine.mjs';
import {seeds} from '../src/client/fly/life-garden/seeds.mjs';
const checks=[];
function check(name,fn){const started=performance.now();fn();checks.push({name,ms:Math.round(performance.now()-started)});}
const sum=a=>a.reduce((x,y)=>x+y,0),diff=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0);
check('FFT round trip retains the field',()=>{const n=16,r=Float64Array.from({length:n*n},(_,i)=>Math.sin(i*.43)),original=r.slice(),im=new Float64Array(n*n),fft=new FFT2(n);fft.run(r,im);fft.run(r,im,true);assert.ok(diff(r,original)<1e-10);});
check('All exhibited seeds survive 1200 steps and match independent NumPy reference',()=>{
  for(const id of ['3GH2s','O2u','OG2g']){const seed=seeds.find(s=>s.id===id),life=new LifeEngine(seed);for(let i=0;i<1200;i++)life.step();const m=life.metrics();assert.ok(m.mass>20,id);assert.ok(Math.abs(m.mass-seed.baseline.finalMass)<.01,`${id} mass mismatch ${m.mass}`);assert.ok(life.a.every(v=>v>=0&&v<=1&&Number.isFinite(v)));}
});
check('Resources affect the calculated body and are consumed',()=>{
  const seed=seeds.find(s=>s.id==='3GH2s'),a=new LifeEngine(seed),b=new LifeEngine(seed);a.brush('food',.57,.5);const resource=sum(a.food);for(let i=0;i<60;i++){a.step();b.step();}assert.ok(diff(a.a,b.a)>1);assert.ok(sum(a.food)<resource);
});
check('Water stroke changes the life field, not just decorative particles',()=>{
  const seed=seeds.find(s=>s.id==='3GH2s'),a=new LifeEngine(seed),b=new LifeEngine(seed);a.brush('flow',.57,.5,.03,-.02);for(let i=0;i<30;i++){a.step();b.step();}assert.ok(diff(a.a,b.a)>10);
});
check('Obstacle blocks occupation and clear removes it',()=>{const a=new LifeEngine(seeds[0]);a.brush('rock',.5,.5);a.step();assert.ok(sum(a.rocks)>0);for(let i=0;i<a.len;i++)if(a.rocks[i])assert.equal(a.a[i],0);a.clearEnvironment();assert.equal(sum(a.rocks),0);});
check('Checkpoint restores the exact continued trajectory including environment',()=>{
  const a=new LifeEngine(seeds[0]);a.brush('food',.52,.5);a.brush('flow',.5,.5,.01,.01);a.environment='current';for(let i=0;i<25;i++)a.step();const b=new LifeEngine(seeds[0]);b.restore(a.snapshot());for(let i=0;i<60;i++){a.step();b.step();}assert.equal(diff(a.a,b.a),0);assert.deepEqual(a.metrics(),b.metrics());
});
check('Corrupt checkpoint is rejected before replacing live cells',()=>{const a=new LifeEngine(seeds[0]),original=a.a.slice(),s=a.snapshot();s.fields.food.pop();assert.throws(()=>a.restore(s));assert.equal(diff(a.a,original),0);});
console.log(JSON.stringify({checks,passed:checks.length},null,2));
