import { defineConfig } from 'tsdown'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Workspace-relative entries resolve against the invoking cwd in tsdown 0.22.
// Absolute entries prevent a successful build from silently emitting the root's empty module.
const root = dirname(fileURLToPath(import.meta.url))
export default defineConfig(['agent-team', 'panda-connector', 'panda-mcp', 'quantskills-host',
  'quantskills-session', 'tool-agent-team'].map(name => {
  const directory = resolve(root, 'packages', name)
  return {
    entry: [resolve(directory, 'lib/types/index.js'), ...(name === 'quantskills-session' ? [resolve(directory, 'lib/types/model-policy.js')] : [])],
    outDir: resolve(directory, 'lib'), tsconfig: resolve(directory, 'tsconfig.json'),
    format: ['esm'] as const, platform: 'node' as const, target: 'es2024',
    fixedExtension: false, dts: false, clean: false,
    deps: { neverBundle: (specifier: string) => !specifier.startsWith('.') && !specifier.startsWith('/') && !/^[A-Za-z]:/.test(specifier) },
  }
}))
