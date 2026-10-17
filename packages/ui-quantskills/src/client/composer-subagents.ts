/** Keep the stock subagent catalog opening upward from the composer icon. */

const MENU_LABELS = ["子代理会话", "Subagent sessions"]

function reactHandler(node: Element, name: "onMouseEnter" | "onMouseLeave"): (() => void) | undefined {
  const key = Object.keys(node).find(item => item.startsWith("__reactProps"))
  if (key === undefined) return undefined
  const props = (node as unknown as Record<string, Record<string, unknown>>)[key]
  const handler = props?.[name]
  return typeof handler === "function" ? handler as () => void : undefined
}

function hoverRoot(): Element | undefined {
  const seat = document.querySelector("[data-composer-subagents]")
  if (seat === null) return undefined
  return [seat, ...seat.querySelectorAll("*")].find(node => reactHandler(node, "onMouseEnter") !== undefined)
}

function catalogMenu(): HTMLElement | undefined {
  return [...document.querySelectorAll("[role='tree']")].find((node): node is HTMLElement => {
    return node instanceof HTMLElement && MENU_LABELS.includes(node.getAttribute("aria-label") ?? "")
  })
}

function placeComposerSubagentMenu(): void {
  const trigger = document.querySelector("[data-composer-subagents] button")
  const panel = catalogMenu()
  if (!(trigger instanceof HTMLElement) || panel === undefined) return
  if (trigger.getAttribute("aria-expanded") !== "true") return
  const rect = trigger.getBoundingClientRect()
  const gap = 8
  const available = Math.max(160, rect.top - gap - 8)
  panel.style.maxHeight = `${available}px`
  const height = panel.getBoundingClientRect().height
  const width = panel.getBoundingClientRect().width || 336
  const top = Math.max(8, rect.top - height - gap)
  const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)
  panel.style.top = `${top}px`
  panel.style.left = `${left}px`
  panel.dataset.qsSubagentMenu = "above"
}

function toggleComposerSubagentMenu(button: HTMLElement): void {
  const root = hoverRoot()
  if (root === undefined) return
  const open = button.getAttribute("aria-expanded") === "true"
  const call = reactHandler(root, open ? "onMouseLeave" : "onMouseEnter")
  call?.()
  window.setTimeout(placeComposerSubagentMenu, 180)
  window.requestAnimationFrame(placeComposerSubagentMenu)
}

let watching = false

function watchComposerSubagentMenu(): void {
  if (watching) return
  const tick = (): void => {
    const open = document.querySelector("[data-composer-subagents] button[aria-expanded='true']")
    if (open === null) {
      watching = false
      return
    }
    placeComposerSubagentMenu()
    window.requestAnimationFrame(tick)
  }
  watching = true
  window.requestAnimationFrame(tick)
}


interface SubagentPopupAddress {
  readonly parentSessionId: string
  readonly childSessionId: string
  readonly mode: string
}

interface SubagentPopupSessions {
  readonly list: { getSnapshot(): { current: string | undefined, byId: Record<string, { displayTitle?: string, origin?: string, parentId?: string } | undefined> } }
  open(id: string): void
  openSubagent(address: SubagentPopupAddress): void
}

let popupParent: string | undefined
let popupSessions: SubagentPopupSessions | undefined

function closeSubagentPopup(): void {
  const sessions = popupSessions
  const parent = popupParent
  popupParent = undefined
  document.body.removeAttribute("data-qs-subagent-popup")
  document.querySelector("[data-qs-subagent-backdrop]")?.remove()
  document.querySelector("[data-qs-subagent-popup-bar]")?.remove()
  if (sessions === undefined || parent === undefined) return
  const current = sessions.list.getSnapshot().current
  if (current === parent) return
  sessions.open(parent)
}

function showSubagentPopup(sessions: SubagentPopupSessions, address: SubagentPopupAddress): void {
  popupSessions = sessions
  document.body.setAttribute("data-qs-subagent-popup", "")
  let backdrop = document.querySelector("[data-qs-subagent-backdrop]")
  if (backdrop === null) {
    backdrop = document.createElement("div")
    backdrop.setAttribute("data-qs-subagent-backdrop", "")
    backdrop.addEventListener("click", closeSubagentPopup)
    document.body.appendChild(backdrop)
  }
  let bar = document.querySelector("[data-qs-subagent-popup-bar]")
  if (bar === null) {
    bar = document.createElement("div")
    bar.setAttribute("data-qs-subagent-popup-bar", "")
    bar.innerHTML = '<div><b>子智能体</b><span data-qs-subagent-popup-title></span></div><button type="button">返回主会话</button>'
    bar.querySelector("button")?.addEventListener("click", closeSubagentPopup)
    document.body.appendChild(bar)
  }
  const snapshot = sessions.list.getSnapshot()
  const title = snapshot.byId[address.childSessionId]?.displayTitle ?? address.childSessionId
  const label = bar.querySelector("[data-qs-subagent-popup-title]")
  if (label !== null) label.textContent = title
}

function installSubagentPopup(sessions: SubagentPopupSessions): void {
  const current = sessions.openSubagent as SubagentPopupSessions["openSubagent"] & { qsPopup?: boolean }
  if (current.qsPopup === true) return
  const openSubagent = current.bind(sessions)
  const wrapped = (address: SubagentPopupAddress): void => {
    if (popupParent === undefined) {
      const current = sessions.list.getSnapshot().current
      popupParent = current !== undefined && current !== address.childSessionId
        ? current
        : address.parentSessionId
    }
    openSubagent(address)
    showSubagentPopup(sessions, address)
  }
  ;(wrapped as { qsPopup?: boolean }).qsPopup = true
  sessions.openSubagent = wrapped
}

/** Install composer click and upward placement for the stock subagent catalog. */
export function bindComposerSubagentMenu(documentRoot: Document, sessions: SubagentPopupSessions): () => void {
  installSubagentPopup(sessions)
  const onClick = (event: Event): void => {
    const target = event.target
    if (!(target instanceof Element)) return
    const button = target.closest("[data-composer-subagents] button")
    if (!(button instanceof HTMLElement)) return
    event.preventDefault()
    event.stopPropagation()
    toggleComposerSubagentMenu(button)
    watchComposerSubagentMenu()
  }
  const observer = new MutationObserver(() => { watchComposerSubagentMenu() })
  observer.observe(documentRoot.body, { childList: true })
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Escape" && document.body.hasAttribute("data-qs-subagent-popup")) closeSubagentPopup()
  }
  documentRoot.addEventListener("click", onClick, true)
  documentRoot.addEventListener("keydown", onKey)
  window.addEventListener("resize", placeComposerSubagentMenu)
  return () => {
    watching = false
    observer.disconnect()
    documentRoot.removeEventListener("click", onClick, true)
    documentRoot.removeEventListener("keydown", onKey)
    window.removeEventListener("resize", placeComposerSubagentMenu)
  }
}
