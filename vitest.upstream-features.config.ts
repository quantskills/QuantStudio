/** Unmodified fixed-upstream UI behavior; complements, not replaces, artifact/browser tests. */
import { defineConfig } from 'vitest/config'
import { relative, resolve } from 'node:path'
import base from './vitest.upstream-ui.config.ts'

const upstream = relative(resolve('.'), resolve(process.env.QS_UPSTREAM_SOURCE ?? '../upstream-dsh-source')).replaceAll('\\', '/')
const packages = [
  'client/ui-settings-web-search', 'client/ui-settings-general', 'client/ui-settings-account',
  'client/ui-plugin-manager', 'client/ui-schedule', 'client/ui-agent-preset',
  'client/ui-model-selection', 'client/ui-settings-models', 'client/ui-settings-subagent',
  'client/ui-subagent', 'client/ui-workspace', 'client/ui-reference',
]
export default defineConfig({
  ...base,
  esbuild: { jsx: 'automatic' },
  plugins: [...base.plugins ?? [], {
    name: 'fixed-upstream-test-roster-anchor',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replaceAll('\\', '/').endsWith('/test-support/client-runtime/src/assembly/bundle-roster.ts')) return
      // The test-support reader must inspect this candidate's installed packages.
      // Do not create an upstream node_modules or change its tracked source.
      return code.replace('anchor: string = fileURLToPath(import.meta.url)',
        `anchor: string = ${JSON.stringify(resolve('package.json'))}`)
    },
  }],
  test: { ...base.test, include: packages.map(pkg => `${upstream}/packages/${pkg}/tests/**/*.spec.{ts,tsx}`),
    setupFiles: [resolve('tests/fixtures/dsh-0.2.1-rc.2/dom-environment.ts')] },
})
