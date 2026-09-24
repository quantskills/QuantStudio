export type JournalEntry = { seq: number; at: number; actor: string; kind: string; decision_id: string; payload: Record<string, any>; merged_count?: number }

// Presentation only: every original neural decision stays in the event ledger.
export function collapseNeuralWaits(events: JournalEntry[]): JournalEntry[] {
  const result: JournalEntry[] = []
  const key = (e: JournalEntry) => e.kind === 'decision' && !e.payload.life_response && e.payload.motor && !e.payload.motor.drive
    ? `${e.actor}:${e.payload.wait_reason?.code || (e.payload.sensory?.visible_food === 0 ? 'food_depleted' : e.payload.motor.reason)}` : null
  for (const event of events) {
    const previous = result[result.length - 1]
    if (previous && key(event) && key(previous) === key(event)) result[result.length - 1] = { ...event, merged_count: (previous.merged_count || 1) + 1 }
    else result.push({ ...event })
  }
  return result
}
