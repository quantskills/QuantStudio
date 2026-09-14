import { defineConfig } from 'tsdown'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = dirname(fileURLToPath(import.meta.url))

/** Build the runtime and invariant as independent bundles so shared fold code stays package-local. */
export default defineConfig([
  {
    entry: [resolve(packageRoot, 'lib/types/index.js')],
    outDir: resolve(packageRoot, 'lib'),
    tsconfig: resolve(packageRoot, 'tsconfig.json'),
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
  {
    entry: [resolve(packageRoot, 'lib/types/invariant.js')],
    outDir: resolve(packageRoot, 'lib'),
    tsconfig: resolve(packageRoot, 'tsconfig.json'),
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
