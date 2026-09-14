// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  createQuantSkillsLayoutStore, createQuantSkillsNotificationStore, createQuantSkillsViewStore,
} from '../src/client/store.ts'

describe('QuantSkills view store', () => {
  beforeEach(() => { localStorage.clear() })

  it('coordinates navigation, 技能 drawers, and display scaling', () => {
    const view = createQuantSkillsViewStore().create()
    view.actions.navigate('skills')
    view.actions.selectSkill('skill-five-day-momentum')
    view.actions.setCategory('02')
    view.actions.setAgentCategory('10')
    view.actions.setSearch('动量')
    view.actions.setCatalogView('grid')
    view.actions.setInterfaceScale(1.15)
    view.actions.setConversationScale(1.1)
    view.actions.setConversationBrightness(0.8)
    view.actions.setColorScheme('dark')
    view.actions.setLightBackground('astronaut')
    view.actions.setDarkBackground('orbital-rings')
    view.actions.requestResultPreview('session-1' as never, 'output/report.html')

    expect(view.store.getSnapshot()).toMatchObject({
      page: 'skills',
      selectedSkill: 'skill-five-day-momentum',
      selectedCategory: '02',
      selectedAgentCategory: '10',
      search: '动量',
      catalogView: 'grid',
      skillDrawerOpen: true,
      interfaceScale: 1.15,
      conversationScale: 1.1,
      conversationBrightness: 0.8,
      colorScheme: 'dark',
      lightBackground: 'astronaut',
      darkBackground: 'orbital-rings',
      resultPreviewRequest: {
        sessionId: 'session-1',
        path: 'output/report.html',
        sequence: 1,
        focusPending: true,
      },
    })

    view.actions.acknowledgeResultPreviewFocus('session-1' as never, 1)
    expect(view.store.getSnapshot().resultPreviewRequest?.focusPending).toBe(false)

    view.actions.navigate('conversations')
    expect(view.store.getSnapshot()).toMatchObject({ page: 'conversations', skillDrawerOpen: false })
    view.actions.navigate('home')
    expect(view.store.getSnapshot().page).toBe('home')
  })

  it('leaves the plugin conversation frame and preserves a manual 专家团 seed until consumed', () => {
    const view = createQuantSkillsViewStore().create()
    view.actions.openPlugin()
    view.actions.openPluginConversation()
    view.actions.requestAgentTeamCreation({
      name: '研究团队',
      description: '验证一个明确目标。',
      leadAgentId: 'agent-lead',
      leadModel: { kind: 'default' },
      members: [{ name: 'validator', agentId: 'agent-member', context: 'fresh', model: { kind: 'default' } }],
    })

    expect(view.store.getSnapshot()).toMatchObject({
      pluginOpen: true,
      pluginConversationOpen: false,
      page: 'teams',
      agentWorkspaceTab: 'teams',
      agentTeamCreationPending: true,
      agentTeamBuilderSeed: { name: '研究团队', leadAgentId: 'agent-lead' },
    })
    view.actions.consumeAgentTeamCreation()
    expect(view.store.getSnapshot()).toMatchObject({
      agentTeamCreationPending: false,
      agentTeamBuilderSeed: undefined,
    })
  })

  it('keeps expert and team navigation independent across library filters and builder shortcuts', () => {
    const view = createQuantSkillsViewStore().create()
    view.actions.navigate('teams')
    expect(view.store.getSnapshot()).toMatchObject({ page: 'teams', agentWorkspaceTab: 'teams' })
    view.actions.navigate('agents')
    expect(view.store.getSnapshot()).toMatchObject({ page: 'agents', agentWorkspaceTab: 'mine' })
    view.actions.setAgentWorkspaceTab('market')
    view.actions.navigate('teams')
    expect(view.store.getSnapshot()).toMatchObject({ page: 'teams', agentWorkspaceTab: 'teams' })
    view.actions.setAgentWorkspaceTab('mine')
    expect(view.store.getSnapshot()).toMatchObject({ page: 'agents', agentWorkspaceTab: 'mine' })
  })

  it('keeps layout visibility in the root-owned layout store', () => {
    const layout = createQuantSkillsLayoutStore().create()
    layout.actions.toggleSidebar()
    layout.actions.openDetails()
    expect(layout.store.getSnapshot()).toEqual({
      sidebarOpen: false, sidebarReservation: 0, detailsOpen: true, detailsReservation: 0,
      resultsOpen: false, conversationTextScale: 1, conversationTextScaleClaimed: false,
    })
    layout.actions.openResults()
    expect(layout.store.getSnapshot()).toEqual({
      sidebarOpen: false, sidebarReservation: 0, detailsOpen: false, detailsReservation: 0,
      resultsOpen: true, conversationTextScale: 1, conversationTextScaleClaimed: false,
    })
    layout.actions.closeResults()
    expect(layout.store.getSnapshot()).toEqual({
      sidebarOpen: false, sidebarReservation: 0, detailsOpen: false, detailsReservation: 0,
      resultsOpen: false, conversationTextScale: 1, conversationTextScaleClaimed: false,
    })
    layout.actions.openDetails()
    expect(layout.store.getSnapshot()).toEqual({
      sidebarOpen: false, sidebarReservation: 0, detailsOpen: true, detailsReservation: 0,
      resultsOpen: false, conversationTextScale: 1, conversationTextScaleClaimed: false,
    })
    layout.actions.closeDetails()
    expect(layout.store.getSnapshot().detailsOpen).toBe(false)
  })

  it('baselines history and persists unread completed or failed run results until acknowledged', () => {
    const notifications = createQuantSkillsNotificationStore().create()
    notifications.actions.sync([
      { sessionId: 'old-complete', updatedAt: 1, runState: 'completed' },
      { sessionId: 'old-failed', updatedAt: 2, runState: 'failed' },
    ])
    expect(notifications.store.getSnapshot().unreadBySession).toEqual({})

    notifications.actions.sync([
      { sessionId: 'old-complete', updatedAt: 3, runState: 'running' },
      { sessionId: 'old-failed', updatedAt: 2, runState: 'failed' },
    ])
    notifications.actions.sync([
      { sessionId: 'old-complete', updatedAt: 3, runState: 'completed' },
      { sessionId: 'old-failed', updatedAt: 4, runState: 'failed' },
    ])
    expect(Object.keys(notifications.store.getSnapshot().unreadBySession)).toEqual([
      'old-complete',
      'old-failed',
    ])

    notifications.actions.acknowledge('old-complete')
    expect(Object.keys(notifications.store.getSnapshot().unreadBySession)).toEqual(['old-failed'])
    expect(createQuantSkillsNotificationStore().create().store.getSnapshot().unreadBySession)
      .toEqual({ 'old-failed': { updatedAt: 4, runState: 'failed' } })
  })
})
