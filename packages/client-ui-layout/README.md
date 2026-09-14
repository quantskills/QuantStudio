# @deepseek-ai/dsh-client-ui-layout

English | [中文](README.zh.md)

Shell plugin: three-column AppFrame (drag handles and concession chain) plus the `ctx.layout` panel-geometry service; it registers into the runtime-owned `root` slot and declares `sidebar`, `conversation`, `details`, and `conversation.empty`. The sidebar resize boundary is an invisible hit strip, while the details boundary retains its floating pill; only details shrinks during concession and then auto-closes. A closed sidebar retains a 56px control rail while details closes to zero width. An application overlay can reserve a transient minimum left or right column through `ctx.layout.reserveSidebar()` or `ctx.layout.reserveDetails()`; concurrent reservations on either side compose by maximum width, and each returned disposer restores the user's unchanged panel preference. A right reservation suppresses the stock details drag handle and publishes the resolved track as `--dsh-shell-details-width`, allowing the reserving overlay to align its own separator while the conversation reflows. An application that owns a complete column calls `ctx.layout.claimSidebar({ width, exclusive: true, onDisplaced })` or `ctx.layout.claimDetails({ width, exclusive: true, onDisplaced })`. Each side accepts one exclusive claim, contributes one solver-constrained track, and keeps the corresponding stock subtree mounted but hidden, inert, unfocusable, and non-interactive. Claims can update their requested width and dragging state; dragging disables column transitions, and release restores the stock width and state. An explicit stock sidebar toggle or `openDetails()` displaces the corresponding claim through `onDisplaced` before the stock panel takes ownership. A plugin that owns the active conversation experience can call `ctx.layout.claimConversationTextScale(scale)`; the single claim projects a concrete base font size only onto the conversation column, supports live updates, and restores scale `1` on release. It never writes document or body styles and cannot change shell chrome, composer controls, or persisted DSH appearance. The package also seats the theme presenter: it consumes resolved `ctx.theme` snapshots and projects them onto the document (`html { color-scheme }` for native UA chrome, `body[data-ds-dark-theme]` from the active color scheme, the theme's alias tokens as inline variables on body, and one owned `<meta name="theme-color">` whose content follows the computed body background). Measuring after palette and token application keeps the rendered background as the single color authority; disposing the presenter removes its metadata node with its other global writes.

AppFrame always mounts the conversation and details columns; a connected Session renders through `SessionProvider`. The transient layout store starts the sidebar at its default width and details closed, and it never reads or writes `localStorage`. Hero and other unselected states also derive a zero rendered details width without changing that stored preference. AppFrame retains the last non-blank Session id across those states: the first Session remains closed, an explicit details action opens the contract default width, returning to the same Session restores its unchanged width, and selecting a different Session closes details before paint. The conversation owner share is empty, while the sidebar owner share contains only `collapsed` and `width`; registrants obtain business data from standard hooks and actions from their own inject faces.

The `/client` exports are the plugin body (`apply`/`inject`), `LayoutController`, and the four owner-share interfaces. AppFrame, the panel store, and the concession solver remain package-internal.

## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Panel geometry is transient** — reload restores the sidebar default and details closed; switching between distinct Session ids also closes details and forgets its dragged width, while unselected surfaces render details at zero width without modifying geometry.
- **Concession-chain auto-close derives a zero width without touching the preferred width** — the panel restores itself when the window widens; consumers must not read the stored details width as the rendered truth.
- **No scroll anchoring during squeeze reflow** — layout changes may move the reader's viewport.
