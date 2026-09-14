import type { AssistantBlock } from '../contract/snapshot.ts'

/** Explicit final-response protocol; paths are claims until the Host reads them. */
export interface FinalDeliverable {
  readonly path: string
  readonly title: string
  readonly presentation: 'card' | 'interactive'
}

function declaration(source: string, unmarked = false): readonly FinalDeliverable[] | undefined {
  try {
    if (source.length > 128 * 1024) return undefined
    const value: unknown = JSON.parse(source)
    if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
      || !('items' in value) || !Array.isArray(value.items) || value.items.length > 64) return undefined
    if (unmarked && (value.items.length === 0 || Object.keys(value).some(key => key !== 'version' && key !== 'items'))) return undefined
    const result: FinalDeliverable[] = []
    for (const item of value.items) {
      if (!item || typeof item !== 'object' || typeof item.path !== 'string' || typeof item.title !== 'string' || item.title.length > 300 || item.path.length > 4096
        || !['card', 'interactive'].includes(item.presentation)) return undefined
      if (unmarked && Object.keys(item).some(key => !['path', 'title', 'presentation'].includes(key))) return undefined
      const path = item.path.replaceAll('\\', '/')
      if (!path.startsWith('output/') || path.endsWith('/') || /[\u0000-\u001f:<>|?*{}]/u.test(path)
        || path.split('/').some((part: string) => part === '' || part === '.' || part === '..')) return undefined
      if (!item.title.trim() || (item.presentation === 'interactive' && !/\.html?$/iu.test(path))) return undefined
      result.push({ path, title: item.title.trim(), presentation: item.presentation })
    }
    return result
  } catch { return undefined }
}

/** Only a closing answer may recover an unmarked JSON manifest with the exact delivery schema. */
export function projectFinalDeliverables(blocks: readonly AssistantBlock[], streaming = false, options: { allowUnmarked?: boolean } = {}): {
  blocks: readonly AssistantBlock[]; items: readonly FinalDeliverable[]
} {
  const items = new Map<string, FinalDeliverable>()
  const projected = blocks.map(block => {
    if (block.kind !== 'text') return block
    const lines = block.text.split('\n')
    const output: string[] = []
    for (let i = 0; i < lines.length; i++) {
      const opening = /^ {0,3}(`{3,}|~{3,})([^\n]*)$/u.exec(lines[i]!)
      if (!opening) { output.push(lines[i]!); continue }
      const fence = opening[1]!
      let end = i + 1
      const closing = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}\\s*$`, 'u')
      while (end < lines.length && !closing.test(lines[end]!)) end++
      const dedicated = opening[2]!.trim() === 'quantskills-deliverables'
      let marker = output.length - 1
      while (marker >= 0 && output[marker]!.trim() === '') marker--
      const compatible = opening[2]!.trim().toLowerCase() === 'json'
        && marker >= 0
        && output[marker]!.trim() === 'quantskills-deliverables'
      const candidate = dedicated || compatible
      const unmarked = !candidate && options.allowUnmarked === true && !streaming
        && ['', 'json'].includes(opening[2]!.trim().toLowerCase())
      const parsed = (candidate || unmarked) && end < lines.length ? declaration(lines.slice(i + 1, end).join('\n'), unmarked) : undefined
      if (parsed !== undefined) {
        if (compatible) output.splice(marker)
        for (const item of parsed) if (!items.has(item.path)) items.set(item.path, item)
      } else if (!(candidate && streaming && end === lines.length)) {
        output.push(...lines.slice(i, Math.min(end + 1, lines.length)))
      } else if (compatible) {
        output.splice(marker)
      }
      i = end
    }
    return { ...block, text: output.join('\n') }
  })
  return { blocks: projected, items: [...items.values()] }
}
