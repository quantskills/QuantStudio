import { clientBundle } from '../tsdown.client.ts'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const bundle = clientBundle('@deepseek-ai/dsh-client-ui-quantskills', ['lib/types/index.js', 'lib/types/invariant.js'])
const require = createRequire(import.meta.url)
export default (options: Parameters<typeof bundle>[0]) => bundle(options).map(config => ({
  ...config,
  ...(config.platform === 'browser' ? { outputOptions: { ...config.outputOptions, codeSplitting: false } } : {}),
  plugins: [...(config.plugins ?? []), {
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
