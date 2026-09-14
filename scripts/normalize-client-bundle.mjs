/** Normalize generated client output for deterministic public archives. */
import { readFileSync, writeFileSync } from 'node:fs'

const paths = [
  new URL('../packages/client-remotes-quantskills/lib/client.js', import.meta.url),
  new URL('../packages/client-ui-chat/lib/client.js', import.meta.url),
  new URL('../packages/client-ui-conversation/lib/client.js', import.meta.url),
  new URL('../packages/client-ui-conversation/lib/types/client/queue/QueueDock.js', import.meta.url),
  new URL('../packages/client-ui-input-trigger/lib/client.js', import.meta.url),
  new URL('../packages/client-ui-input-trigger/lib/types/client/MenuView.js', import.meta.url),
  new URL('../packages/client-ui-layout/lib/client.js', import.meta.url),
  new URL('../packages/ui-quantskills/lib/client.js', import.meta.url),
]

for (const path of paths) {
  const source = readFileSync(path, 'utf8')
  const normalized = source
    .replace(/[\t ]+$/gm, '')
    .replace(/^(\s*\/\/#region \\0dsh-(?:css|png|image):)(.+)$/gm, (_line, prefix, rawSpecifier) => {
      const specifier = String(rawSpecifier).replaceAll('\\', '/')
      if (specifier.startsWith('packages/')) return `${prefix}${specifier}`
      const packagesIndex = specifier.lastIndexOf('/packages/')
      if (packagesIndex < 0) throw new Error(`Cannot normalize generated client module path: ${specifier}`)
      return `${prefix}${specifier.slice(packagesIndex + 1)}`
    })

  if (normalized !== source) writeFileSync(path, normalized)
}
