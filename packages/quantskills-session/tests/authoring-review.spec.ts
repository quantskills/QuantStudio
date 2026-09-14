import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { applyAuthoringReview } from '../src/index.ts'

const digest = 'sha256:' + 'a'.repeat(64)
const started = (kind: string) => ({ type: 'quantskills/authoring-started', data: { kind } }) as SessionEvent
const call = (name: string, callId = 'draft') => ({ type: 'tool/call', data: { name, callId } }) as SessionEvent
const output = (value: unknown, callId = 'draft', isError = false) => ({ type: 'tool/result', data: { message: {
  content: [{ toolCallId: callId, isError, content: [{ type: 'text', text: JSON.stringify(value) }] }],
} } }) as SessionEvent
const asset = (kind: 'skill' | 'agent') => ({ kind: 'draft', draft: {
  assetId: kind + '-research', assetKind: kind, declaration: kind === 'skill' ? 'SKILL.md' : 'AGENTS.md',
  draftPath: 'quantskills-drafts/' + kind + '-research', treeDigest: digest,
  fileCount: 1, totalBytes: 120, requires: [],
}, diagnostics: [] })
const team = { kind: 'draft', treeDigest: digest, draft: {
  name: '研究团队', description: '完成研究报告', lead: { agentId: 'lead', revision: 1 }, leadModel: { kind: 'default' },
  members: [{ name: 'researcher', responsibility: '分析数据', context: 'fresh', agent: { agentId: 'member', revision: 1 }, model: { kind: 'default' } }],
  diagnostics: [],
}, diagnostics: [] }
const initial = () => ({ kind: null, calls: [], pending: null })
describe('durable authoring review projection', () => {
  it.each(['skill', 'agent', 'agent-team'] as const)('restores only a matching successful %s draft from log replay', kind => {
    let state = applyAuthoringReview(initial(), started(kind))
    state = applyAuthoringReview(state, call(kind === 'agent-team' ? 'quantskills_team_draft' : 'quantskills_asset_draft'))
    state = applyAuthoringReview(state, output(kind === 'agent-team' ? team : asset(kind)))
    expect(state.pending).toMatchObject({ kind, toolCallId: 'draft', treeDigest: digest })
    expect(state.pending?.members.length).toBe(kind === 'agent-team' ? 1 : 0)
  })
  it('ignores fabricated, unrelated, failed and wrong-kind tool results', () => {
    const state = applyAuthoringReview(initial(), started('skill'))
    expect(applyAuthoringReview(state, output(asset('skill'))).pending).toBeNull()
    const called = applyAuthoringReview(state, call('quantskills_asset_draft'))
    expect(applyAuthoringReview(called, output(asset('skill'), 'draft', true)).pending).toBeNull()
    expect(applyAuthoringReview(called, output(asset('agent'))).pending).toBeNull()
    expect(applyAuthoringReview(called, output({ kind: 'draft' })).pending).toBeNull()
  })
  it('retires the old draft when preparation restarts, so failed edits cannot offer stale creation', () => {
    let state = applyAuthoringReview(initial(), started('skill'))
    state = applyAuthoringReview(state, call('quantskills_asset_draft'))
    state = applyAuthoringReview(state, output(asset('skill')))
    expect(state.pending).not.toBeNull()
    state = applyAuthoringReview(state, call('quantskills_asset_draft', 'new-draft'))
    state = applyAuthoringReview(state, output({ error: 'invalid' }, 'new-draft', true))
    expect(state.pending).toBeNull()
  })
  it('does not offer a successfully committed draft again after replay', () => {
    let state = applyAuthoringReview(initial(), started('skill'))
    state = applyAuthoringReview(state, call('quantskills_asset_draft'))
    state = applyAuthoringReview(state, output(asset('skill')))
    const version = {
      versionId: 'skill-research@' + 'a'.repeat(40), assetId: 'skill-research', kind: 'skill',
      repository: 'local-authoring:skill-research', commit: 'a'.repeat(40), declaration: 'SKILL.md',
      treeDigest: digest, fileCount: 1, totalBytes: 120, installedAt: 1, exposure: 'skill-registry', origin: 'local-authoring',
    }
    state = applyAuthoringReview(state, { type: 'quantskills/authoring-committed', data: {
      toolCallId: 'draft', treeDigest: digest, result: { kind: 'skill', version },
    } } as SessionEvent)
    expect(state.pending).toBeNull()
  })
})
