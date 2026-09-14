import { defineConfig } from 'tsdown'

/** Build every extracted QuantSkills Host package from its generated Typert faces. */
export default defineConfig({
  workspace: [
    'packages/agent-team',
    'packages/panda-connector',
    'packages/panda-mcp',
    'packages/quantskills-host',
    'packages/quantskills-session',
    'packages/tool-agent-team',
  ],
  entry: ['lib/types/{index,invariant}.js'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
})
