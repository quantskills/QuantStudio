import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  freezeDefinition, MAX_AGENT_DOCUMENT_BYTES, QuantSkillsAgentStore,
} from '../src/agent-store.ts'

const commit = 'a'.repeat(40)
const treeDigest = `sha256:${'b'.repeat(64)}`
const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-agent-store-'))
  roots.push(root)
  return root
}

function agent(index: number, role = '完成可复现的量化研究。') {
  return freezeDefinition({
    agentId: `agent-00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    revision: 1,
    name: `研究 Agent ${String(index)}`,
    role,
    mode: 'dynamic',
    permission: 'workspace-write',
    skills: [{
      assetId: 'skill-five-day-momentum',
      versionId: `skill-five-day-momentum@${commit}`,
      commit,
      treeDigest,
    }],
    createdAt: index,
    updatedAt: index,
  })
}

describe('QuantSkillsAgentStore', () => {
  it('persists underscore asset identities from approved repositories', async () => {
    const root = await temporaryRoot()
    const store = new QuantSkillsAgentStore(root)
    const definition = freezeDefinition({
      ...agent(1),
      sourceVersionId: `agent-research_assistant@${commit}`,
      skills: [{
        assetId: 'skill-backtest_assumption_check',
        versionId: `skill-backtest_assumption_check@${commit}`,
        commit,
        treeDigest,
      }],
    })

    await store.mutate(() => ({ agents: [definition], result: undefined }))

    await expect(store.list()).resolves.toEqual([definition])
  })

  it('serializes read-modify-write across two stores sharing one Harness home', async () => {
    const root = await temporaryRoot()
    const first = new QuantSkillsAgentStore(root)
    const second = new QuantSkillsAgentStore(root)

    await Promise.all([
      first.mutate(agents => ({ agents: [...agents, agent(1)], result: undefined })),
      second.mutate(agents => ({ agents: [...agents, agent(2)], result: undefined })),
    ])

    await expect(first.list()).resolves.toHaveLength(2)
  })

  it('accepts an exact-size document and rejects one extra byte', async () => {
    const root = await temporaryRoot()
    const store = new QuantSkillsAgentStore(root)
    await store.list()
    const path = join(root, 'quantskills', 'agents.json')
    const base = '{"schemaVersion":1,"agents":[]}'
    const exact = base + ' '.repeat(MAX_AGENT_DOCUMENT_BYTES - Buffer.byteLength(base))

    await writeFile(path, exact, 'utf8')
    await expect(store.list()).resolves.toEqual([])
    await writeFile(path, `${exact} `, 'utf8')
    await expect(store.list()).rejects.toThrow('bounded regular file')
  })

  it('refuses an oversized mutation without replacing the previous document', async () => {
    const root = await temporaryRoot()
    const store = new QuantSkillsAgentStore(root)
    await store.mutate(() => ({ agents: [agent(1)], result: undefined }))
    const path = join(root, 'quantskills', 'agents.json')
    const previous = await readFile(path, 'utf8')
    const oversized = Array.from({ length: 200 }, (_, index) => agent(index + 2, '界'.repeat(8_000)))

    await expect(store.mutate(() => ({ agents: oversized, result: undefined })))
      .rejects.toThrow('document exceeds')
    expect(await readFile(path, 'utf8')).toBe(previous)
    await expect(store.list()).resolves.toEqual([agent(1)])
  })

  it.each([
    ['Agent asset id', [{
      assetId: 'agent-portfolio',
      versionId: `agent-portfolio@${commit}`,
      commit,
      treeDigest,
    }]],
    ['duplicate Skill asset', [
      {
        assetId: 'skill-five-day-momentum',
        versionId: `skill-five-day-momentum@${commit}`,
        commit,
        treeDigest,
      },
      {
        assetId: 'skill-five-day-momentum',
        versionId: `skill-five-day-momentum@${commit}`,
        commit,
        treeDigest,
      },
    ]],
  ])('fails closed for a durable definition with %s', async (_label, skills) => {
    const root = await temporaryRoot()
    const path = join(root, 'quantskills', 'agents.json')
    await mkdir(join(root, 'quantskills'), { recursive: true })
    await writeFile(path, JSON.stringify({
      schemaVersion: 1,
      agents: [{
        agentId: 'agent-00000000-0000-4000-8000-000000000001',
        revision: 1,
        name: '损坏定义',
        role: '不应进入运行时。',
        mode: 'dynamic',
        skills,
        createdAt: 1,
        updatedAt: 1,
      }],
    }), 'utf8')

    await expect(new QuantSkillsAgentStore(root).list()).rejects.toThrow()
  })
})
