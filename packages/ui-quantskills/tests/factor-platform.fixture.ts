import type { JsonValue } from '@deepseek-ai/dsh-util-values'
import { FactorApiError, type FactorRuntime } from '../../quantskills-session/src/factor-contest-cli.ts'
import { FactorContestService } from '../../quantskills-session/src/factor-contest-service.ts'
import type { FactorContestAccess } from '../src/client/factor-contest.ts'

/** Stateful upstream substitute. UI and Host service run unchanged, with durable local state.
 * This never contacts PandaAI and must not be reported as a real platform backtest.
 */
export function factorPlatform(home: string) {
  type Row = Record<string, JsonValue>
  let pool: Row | null = null, balance = 100, account = 'test-factor-user', authenticated = false
  let sequence = 0, loseMutationReply = false, loseRunReply = false
  const definitions = new Map<string, Row>(), results = new Map<string, Row>(), receipts = new Map<string, JsonValue>()
  const updates = new Map<string, string>()
  const queries: string[] = [], mutations: string[] = [], sessions: string[] = [], calls: string[] = []
  function recount() {
    const factors = pool!.factors as Row[]
    pool!.ready_factor_count = factors.length
    pool!.active_factor_count = pool!.status === 'active' ? factors.length : 0
    if (pool!.submitted_at === null) pool!.status = factors.length ? 'validating' : 'draft'
  }
  const runtime: FactorRuntime = {
    install: async (_path, version) => version, latest: async () => '0.1.7',
    login: async credentials => { if (credentials.password !== 'test-only') throw new FactorApiError('LOGIN_FAILED'); authenticated = true; return account },
    identity: async () => { if (!authenticated) throw new FactorApiError('LOGIN_REQUIRED'); return account },
    logout: async () => { authenticated = false },
    cli: async (_path, args) => {
      calls.push(args[0]!)
      if (args[0] === 'balance') return { success: true, balance: { computingPower: balance } }
      if (args[0] === 'factor_create') {
        const id = 'workflow-' + ++sequence, option = (name: string) => args[args.indexOf(name) + 1]!
        definitions.set(id, { _id: id, name: option('--name'), content: option(args.includes('--formula') ? '--formula' : '--code'), last_run_id: null })
        return { success: true, factor_id: id }
      }
      if (args[0] === 'factor_run') {
        const definition = definitions.get(args[1]!)!
        const id = 'run-' + args[1]
        definition.last_run_id = id; balance -= 2
        results.set(id, { success: true, factor_run_id: id, status: 2, results: { Rank_IC: 0.061, turnover: 0.12 } })
        if (loseRunReply) { loseRunReply = false; throw new Error('Test: lost backtest response') }
        return { ...results.get(id)!, status: 'SUCCESS' }
      }
      if (args[0] === 'factor_info') {
        if (!definitions.has(args[1]!)) throw new FactorApiError('NOT_FOUND', true)
        return { success: true, ...structuredClone(definitions.get(args[1]!)) }
      }
      if (args[0] === 'factor_result') return structuredClone(results.get(args[1]!)!)
      if (args[0] === 'factor_list') return { success: true, total: definitions.size, factors: [...definitions.values()] }
      throw new Error('Unexpected CLI command ' + args[0])
    },
    arena: async (path, _signal, mutation) => {
      if (mutation) {
        if (receipts.has(mutation.key)) return structuredClone(receipts.get(mutation.key)!)
        mutations.push(path)
        const body = (mutation.body ?? {}) as Row
        if (path === '/factorPool/pools') {
          if (pool) throw new FactorApiError('POOL_EXISTS', true)
          pool = { pool_id: 'pool-test', ...body, status: 'draft', cycle_locked: false, settling: false,
            submitted_at: null, ready_factor_count: 0, active_factor_count: 0, modification_window: { open: false }, factors: [] }
        } else if (path.endsWith('/submit')) {
          if ((pool!.factors as Row[]).length < 5) throw new FactorApiError('NOT_ENOUGH_FACTORS', true)
          pool!.status = 'active'; pool!.cycle_locked = true; pool!.submitted_at = '2026-09-29'
          recount()
        } else if (path.endsWith('/factors')) {
          const definition = definitions.get(String(body.workflow_id))!
          if (!definition?.last_run_id) throw new FactorApiError('NOT_READY', true)
          if ((pool!.factors as Row[]).some(f => f.workflow_id === body.workflow_id)) throw new FactorApiError('DUPLICATE_FACTOR', true)
          ;(pool!.factors as Row[]).push({ factor_instance_id: 'instance-' + body.workflow_id, workflow_id: body.workflow_id!,
            factor_name: definition.name!, status: 'ready', revision: 1, can_edit: true, can_delete: true })
          recount()
        } else if (path.includes('/factors/')) {
          const factorId = path.split('/').at(-1), factors = pool!.factors as Row[]
          if (mutation.method === 'DELETE') pool!.factors = factors.filter(f => f.factor_instance_id !== factorId)
          else {
            const f = factors.find(f => f.factor_instance_id === factorId)!, definition = definitions.get(String(body.workflow_id))!
            f.workflow_id = body.workflow_id!; f.factor_name = definition.name!; f.revision = Number(f.revision) + 1
          }
          recount()
        } else { Object.assign(pool!, body) }
        const result = { accepted: true, pool_id: 'pool-test' }; receipts.set(mutation.key, result)
        if (loseMutationReply) { loseMutationReply = false; throw new Error('Test: lost mutation response') }
        return result
      }
      queries.push(path)
      if (path === '/factorArena/me/registration-state') return { currentStatus: 'approved' }
      if (path === '/factorPool/pools') { if (!pool) throw new FactorApiError('POOL_NOT_FOUND'); return structuredClone(pool) }
      if (path.startsWith('/factorPool/workflows?')) return { total: definitions.size, items: [...definitions.values()].map(d => {
        const inPool = ((pool?.factors ?? []) as Row[]).some(f => f.workflow_id === d._id)
        const target = updates.get(String(d._id))
        if (target && ((pool?.factors ?? []) as Row[]).some(f => f.factor_instance_id === target && f.workflow_id !== d._id)) return {
          workflow_id: d._id!, name: d.name!, factor_instance_id: target, action: 'update', action_enabled: true, in_pool: false,
        }
        return { workflow_id: d._id!, name: d.name!, in_pool: inPool, action: 'add', action_enabled: Boolean(d.last_run_id) && !inPool }
      }) }
      if (path.endsWith('/scores')) return { scores: [{ monthly_points: 12, rank: 3 }] }
      throw new Error('Unexpected arena path ' + path)
    },
  }
  const service = new FactorContestService(runtime, home)
  const access: FactorContestAccess = {
    status: id => service.status(id), mode: value => service.mode(value), connect: value => service.connect(value),
    disconnect: () => service.disconnect(), checkUpdate: () => service.checkUpdate(), update: () => service.update(),
    inspect: (_session, signal) => service.inspect(undefined, signal), query: (q, signal) => service.query(q, undefined, signal),
    prepare: (action, session = 'factor-workbench') => service.prepare(session, action),
    confirm: p => service.confirm(p.id, p.sessionId), dismiss: p => service.dismiss(p.id, p.sessionId),
    stopBudget: id => service.stopBudget(id), reconcileRun: id => service.reconcileRun(id), reconcilePlan: id => service.reconcilePlan(id),
    startResearch: async topic => { await service.researchIdentity(); sessions.push(topic ? 'topic' : 'main') },
    requestResearch: async () => { throw new Error('Use the real model-tool test for conversation execution') },
  }
  return { service, access, runtime, calls, queries, mutations, sessions,
    offerVersion: (workflowId: string, factorId: string) => updates.set(workflowId, factorId),
    pool: () => structuredClone(pool), balance: () => balance,
    loseMutation: () => { loseMutationReply = true }, loseRun: () => { loseRunReply = true },
    expireLogin: () => { authenticated = false }, switchAccount: () => { account = 'another-user' },
    openWindow: () => { pool!.modification_window = { open: true } },
  }
}
