/** Runtime compatibility registration for QuantSkills-owned durable Session events. */

import { KNOWN_SESSION_EVENT_TYPES } from '@deepseek-ai/dsh-session'

/** Durable event types written by the QuantSkills plugin suite. */
export const QUANTSKILLS_SESSION_EVENT_TYPES = Object.freeze([
  'quantskills/plain-session',
  'quantskills/session-bound',
  'quantskills/agent-session',
  'quantskills/agent-team-session',
  'quantskills/agent-team-member',
  'quantskills/resident-skill-changed',
  'quantskills/file-attached',
  'panda/runtime-bound',
  'quantskills/authoring-started',
  'quantskills/authoring-committed',
] as const)

/**
 * Extends the DSH rc.2 process-wide event catalog before QuantSkills sessions are restored.
 *
 * @returns Nothing.
 */
export function registerQuantSkillsSessionEventTypes(): void {
  if (!(KNOWN_SESSION_EVENT_TYPES instanceof Set)) {
    throw new Error('installed DSH session event catalog does not support plugin event registration')
  }
  for (const type of QUANTSKILLS_SESSION_EVENT_TYPES) KNOWN_SESSION_EVENT_TYPES.add(type)
}
