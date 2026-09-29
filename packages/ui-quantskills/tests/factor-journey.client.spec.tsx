// @vitest-environment jsdom
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { FactorContestPage } from '../src/client/FactorContestPage.tsx'
import { factorPlatform } from './factor-platform.fixture.ts'
import type { FactorPlan } from '../src/client/plugin-types.ts'

const homes: string[] = []
afterEach(async () => {
  cleanup()
  for (const home of homes.splice(0)) {
    if (!home.startsWith(join(tmpdir(), 'qs-factor-journey-'))) throw new Error('Unexpected test path')
    await rm(home, { recursive: true, force: true })
  }
})
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name, exact: typeof name === 'string' }))
async function focus() { await act(async () => { window.dispatchEvent(new Event('focus')) }) }
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), 'qs-factor-journey-')); homes.push(home)
  const f = factorPlatform(home)
  render(<FactorContestPage access={f.access}/>)
  await screen.findByRole('button', { name: '开启因子比赛' }); click('开启因子比赛')
  await screen.findByRole('button', { name: '登录并连接' }); click('登录并连接')
  fireEvent.change(screen.getByLabelText('手机号'), { target: { value: '13800000000' } })
  fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'test-only' } })
  click('连接因子账户')
  await screen.findByText('还没有比赛因子池')
  await waitFor(() => expect((screen.getByRole('button', { name: '创建因子池' }) as HTMLButtonElement).disabled).toBe(false))
  return { ...f, home }
}
async function confirm(name = '确认执行此操作') {
  const dialog = await screen.findByRole('dialog', { name: '确认因子比赛操作' })
  fireEvent.click(within(dialog).getByRole('button', { name }))
  await within(dialog).findByText('已完成')
  expect(within(dialog).queryByRole('button', { name })).toBeNull()
  click('关闭确认因子比赛操作')
}
async function createPool() {
  click('创建因子池')
  fireEvent.change(screen.getByLabelText('因子池名称'), { target: { value: '低换手验证池' } })
  fireEvent.change(screen.getByLabelText('风格标签'), { target: { value: '反转' } })
  click('生成确认计划')
  await confirm()
  await screen.findByRole('button', { name: '修改因子池设置' })
}
const batch = { hypothesis: '低换手反转的分年稳定性', maxRuns: 6, creditThreshold: 20, startDate: '20240101', endDate: '20241231', cycle: 5 }

describe('factor full business journey through the rendered UI and real Host service', () => {
  it('connects, creates/edits a pool, approves research, reads results, adds five candidates, replaces/removes one and submits', async () => {
    const f = await fixture()
    click('进入 AI 因子助手'); await waitFor(() => expect(f.sessions).toEqual(['main']))
    click('新建因子专题'); await waitFor(() => expect(f.sessions).toEqual(['main', 'topic']))
    await createPool()
    expect(f.pool()).toMatchObject({ name: '低换手验证池', rebalance_cycle_days: 5, factors: [] })
    click('修改因子池设置')
    fireEvent.change(screen.getByLabelText('因子池名称'), { target: { value: '分年稳定性研究池' } })
    click('生成确认计划'); await confirm()
    expect(f.pool()!.name).toBe('分年稳定性研究池')

    let budget!: FactorPlan
    await act(async () => { budget = await f.service.prepare('research-main', { kind: 'budget', batch }) })
    await focus()
    click(/授权一批因子研究/)
    await confirm('确认授权本批次')
    const identity = (await f.service.status()).identity!
    // Represents the model's approved tool call; the production runCandidate method writes real journals.
    for (let i = 1; i <= 6; i++) await act(async () => {
      const run = await f.service.runCandidate('research-main', budget.id, { requestId: 'candidate-' + i, name: '候选因子 ' + i, formula: '-RANK(CLOSE/DELAY(CLOSE,20))', direction: 1 }, identity)
      expect(run.status).toBe('completed')
    })
    await focus()
    fireEvent.click(screen.getByRole('tab', { name: /回测记录/ }))
    expect(screen.getAllByRole('button', { name: '查看因子与结果' })).toHaveLength(6)
    fireEvent.click(screen.getAllByRole('button', { name: '查询完整回测结果' })[0]!)
    const result = await screen.findByRole('dialog', { name: '因子详情与回测结果' })
    expect(result.textContent).toContain('0.061')
    click('关闭因子详情与回测结果')
    fireEvent.click(screen.getByRole('tab', { name: '全部研究因子' }))
    await screen.findByRole('button', { name: '刷新当前数据' })
    await waitFor(() => expect(screen.getAllByRole('button', { name: '查看因子定义' })).toHaveLength(6))
    fireEvent.click(screen.getAllByRole('button', { name: '查看因子定义' })[0]!)
    expect((await screen.findByRole('dialog', { name: '因子详情与回测结果' })).textContent).toContain('-RANK(CLOSE/DELAY(CLOSE,20))')
    click('关闭因子详情与回测结果')

    fireEvent.click(screen.getByRole('tab', { name: '可入池工作流' }))
    for (let i = 1; i <= 5; i++) {
      await waitFor(() => expect(screen.getAllByRole('button', { name: '准备加入因子池' }).filter(b => !(b as HTMLButtonElement).disabled)).toHaveLength(7 - i))
      fireEvent.click(screen.getAllByRole('button', { name: '准备加入因子池' }).find(b => !(b as HTMLButtonElement).disabled)!)
      await confirm()
      expect((f.pool()!.factors as unknown[]).length).toBe(i)
    }
    fireEvent.click(screen.getByRole('tab', { name: '比赛因子池' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '准备正式参赛' }) as HTMLButtonElement).disabled).toBe(false))
    f.offerVersion('workflow-6', 'instance-workflow-1')
    fireEvent.click(screen.getAllByRole('button', { name: '更新工作流' })[0]!)
    await screen.findByRole('button', { name: '使用此版本生成确认计划' })
    click('使用此版本生成确认计划'); await confirm()
    expect((f.pool()!.factors as Record<string, unknown>[])[0]).toMatchObject({ workflow_id: 'workflow-6', revision: 2 })
    fireEvent.click(screen.getAllByRole('button', { name: '准备删除' })[0]!); await confirm()
    await waitFor(() => expect((screen.getByRole('button', { name: '准备正式参赛' }) as HTMLButtonElement).disabled).toBe(true))
    expect((f.pool()!.factors as unknown[]).length).toBe(4)
    fireEvent.click(screen.getByRole('tab', { name: '可入池工作流' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: '准备加入因子池' }).filter(b => !(b as HTMLButtonElement).disabled)).toHaveLength(2))
    fireEvent.click(screen.getAllByRole('button', { name: '准备加入因子池' }).find(b => !(b as HTMLButtonElement).disabled)!)
    await confirm()
    fireEvent.click(screen.getByRole('tab', { name: '比赛因子池' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '准备正式参赛' }) as HTMLButtonElement).disabled).toBe(false))
    click('准备正式参赛'); await confirm()
    await screen.findByText('已参赛')
    expect(f.pool()).toMatchObject({ status: 'active', cycle_locked: true, ready_factor_count: 5, active_factor_count: 5 })
    click('修改因子池设置')
    expect((screen.getByLabelText('统一调仓周期（交易日）') as HTMLInputElement).disabled).toBe(true)
    click('关闭修改比赛因子池')
    fireEvent.click(screen.getByRole('tab', { name: '积分与成绩' }))
    await screen.findByText('月度积分')
    expect(f.queries).toContain('/factorPool/pools/pool-test/scores')
    expect(f.calls.filter(c => c === 'factor_run')).toHaveLength(6)
    expect(f.balance()).toBe(88)
    const journal = JSON.parse(await readFile(join(f.home, 'quantskills/factor-contest/state.json'), 'utf8'))
    expect(journal.runs).toHaveLength(6); expect(journal.budgets[0].status).toBe('exhausted')
    expect(f.mutations.filter(p => p.endsWith('/submit'))).toHaveLength(1)
  }, 20000)

  it('cancels a prepared mutation, reconciles a lost receipt without resending, stops budgets, checks CLI version and logs out', async () => {
    const f = await fixture(); await createPool()
    click('修改因子池设置')
    fireEvent.change(screen.getByLabelText('因子池名称'), { target: { value: '不应保存的名称' } })
    click('生成确认计划')
    await screen.findByRole('dialog', { name: '确认因子比赛操作' }); click('取消计划')
    await within(screen.getByRole('dialog', { name: '确认因子比赛操作' })).findByText('已取消')
    click('关闭确认因子比赛操作'); expect(f.pool()!.name).toBe('低换手验证池')
    click('修改因子池设置'); fireEvent.change(screen.getByLabelText('因子池名称'), { target: { value: '回执丢失后核对' } })
    click('生成确认计划'); await screen.findByRole('dialog', { name: '确认因子比赛操作' })
    f.loseMutation(); click('确认执行此操作')
    await screen.findByRole('button', { name: '只读核对结果' })
    const before = f.mutations.length; click('只读核对结果')
    await within(screen.getByRole('dialog', { name: '确认因子比赛操作' })).findByText('已完成')
    expect(f.mutations.length).toBe(before)
    click('关闭确认因子比赛操作'); await screen.findByText('回执丢失后核对', { selector: 'strong' })
    const budget = await f.service.prepare('research-main', { kind: 'budget', batch }); await f.service.confirm(budget.id, 'research-main')
    await focus(); fireEvent.click(screen.getByRole('tab', { name: /研究批次/ }))
    click('停止追加回测')
    await waitFor(() => expect(screen.queryByRole('button', { name: '停止追加回测' })).toBeNull())
    expect((await f.service.status()).budgets[0]!.status).toBe('stopped')
    click('账户与设置'); click('检查 CLI 更新')
    await screen.findByText('当前版本 0.1.7 · 最新 0.1.7')
    click('退出账户')
    await waitFor(() => expect(screen.queryByRole('button', { name: '退出账户' })).toBeNull())
    click('关闭因子账户与设置')
    expect((screen.getByRole('button', { name: '进入 AI 因子助手' }) as HTMLButtonElement).disabled).toBe(true)
    expect(f.calls.filter(c => c === 'factor_run')).toHaveLength(0)
  })
})
