import test from 'node:test'
import assert from 'node:assert/strict'
import { corpus, teamAcceptance, inventoryOracle } from '../corpus-v2.mjs'
import { within } from '../lib/config.mjs'
import { resolve } from 'node:path'
test('new corpus has twelve cases across six families and two input variants',()=>{
 assert.equal(corpus.length,12);assert.equal(new Set(corpus.map(c=>c.family)).size,6)
 assert.equal(new Set(corpus.map(c=>c.id)).size,12)
 assert.equal(teamAcceptance.length,6)
 for(const c of corpus){assert.ok(c.phases.every(p=>p.expected));assert.equal(c.fixture.expected,undefined)}
})
test('new oracle preserves missing data and ignores double-counted reservation fields',()=>{
 assert.deepEqual(inventoryOracle({rows:[{id:'a',received:10,shipped:3,damaged:1,reserved:9}]}),{available:6,rows:1,unknown:[]})
 assert.deepEqual(inventoryOracle({rows:[{id:'a',received:10,shipped:3,damaged:null}]}),{available:null,rows:1,unknown:['a']})
})
test('path boundary rejects sibling prefixes, traversal and the root itself',()=>{
 const root=resolve('isolated');assert.ok(within(root,resolve(root,'run-a')))
 assert.ok(!within(root,root));assert.ok(!within(root,resolve(root,'../isolated-extra/run')))
})
