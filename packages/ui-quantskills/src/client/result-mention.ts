/** Capture clickable Assistant file mentions before the generic workspace opener. */

/** Callback used to hand a resolved result mention to the owning application. */
export type QuantSkillsResultMentionOpen = (path: string, trigger: HTMLButtonElement) => boolean

/**
 * Route inline-code file mentions into the QuantSkills result workbench.
 *
 * The shared Markdown renderer owns the button and normally opens the file in
 * the Host. QuantSkills handles only mentions accepted by `open`; rejected
 * paths keep the shared behavior.
 * @param document - Browser document containing the conversation transcript.
 * @param open - Result-workbench opener; return true when the click is owned.
 * @returns disposer for the capture listener.
 */
export function bindQuantSkillsResultMentionClicks(
  document: Document,
  open: QuantSkillsResultMentionOpen,
): () => void {
  const view = document.defaultView
  if (view === null) return () => {}
  const handleClick = (event: MouseEvent): void => {
    if (!(event.target instanceof view.Element)) return
    const trigger = event.target.closest('code > button[title]')
    if (!(trigger instanceof view.HTMLButtonElement)) return
    const path = trigger.title.trim()
    if (path === '' || !open(path, trigger)) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  document.addEventListener('click', handleClick, { capture: true })
  return () => { document.removeEventListener('click', handleClick, { capture: true }) }
}
