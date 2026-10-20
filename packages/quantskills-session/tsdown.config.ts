import { defineConfig } from 'tsdown'
export default defineConfig({ entry: ['lib/types/index.js', 'lib/types/model-policy.js'], outDir: 'lib',
  format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false })
