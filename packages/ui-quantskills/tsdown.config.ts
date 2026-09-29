import { clientBundle } from '../tsdown.client.ts'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const bundle = clientBundle('@deepseek-ai/dsh-client-ui-quantskills', ['lib/types/index.js', 'lib/types/invariant.js'])
const require = createRequire(import.meta.url)
export default (options: Parameters<typeof bundle>[0]) => bundle(options).map(config => ({
  ...config,
  ...(config.platform === 'browser' ? { outputOptions: { ...config.outputOptions, codeSplitting: false } } : {}),
  plugins: [...(config.plugins ?? []), {
    name: 'quantskills-garden-source',
    resolveId(source: string, importer?: string) {
      if (!importer || !source.startsWith('./') || !/\.(mjs|html)\?raw$/.test(source)) return null
      const path = resolve(dirname(importer), source.slice(0, -4)).replaceAll('\\', '/').replace('/lib/types/', '/src/')
      return '\0quantskills-garden-source:' + path.slice(path.lastIndexOf('/src/') + 1)
    },
    load(id: string) {
      const prefix = '\0quantskills-garden-source:'
      return id.startsWith(prefix) ? `export default ${JSON.stringify(readFileSync(new URL(id.slice(prefix.length), import.meta.url), 'utf8'))}` : null
    },
  }, {
    name: 'quantskills-local-pdf-worker',
    resolveId(source: string) {
      return source === 'pdfjs-dist/build/pdf.worker.min.mjs?raw' ? '\0quantskills-pdf-worker' : null
    },
    load(id: string) {
      return id === '\0quantskills-pdf-worker'
        ? `export default ${JSON.stringify(readFileSync(require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), 'utf8'))}` : null
    },
  }],
}))
