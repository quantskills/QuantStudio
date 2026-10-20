/** Fixed upstream test support; the four customized packages always resolve to QS source. */
import { defineConfig } from 'vitest/config'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve, relative, isAbsolute, dirname } from 'node:path'
import ts from 'typescript'

const root = resolve('.'), upstream = resolve(process.env.QS_UPSTREAM_SOURCE ?? '../upstream-dsh-source')
const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: upstream, encoding: 'utf8', windowsHide: true })
if (revision.status !== 0 || revision.stdout.trim() !== '687f282e8625c6b8d11ff58211a90524be2e4317') throw new Error('UI tests require the fixed rc.2 upstream source checkout.')
const config = ts.readConfigFile(resolve(upstream, 'tsconfig.base.json'), ts.sys.readFile)
if (config.error) throw new Error('Cannot read the upstream source resolution map.')
const customized = ['ui-chat', 'ui-conversation', 'ui-layout', 'ui-input-trigger']
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const alias = Object.entries(config.config.compilerOptions.paths as Record<string, string[]>)
  .sort(([a], [b]) => b.replace('*', '').length - a.replace('*', '').length)
  .map(([name, paths]) => {
    let target = resolve(upstream, paths[0]!)
    for (const pkg of customized) {
      const base = resolve(upstream, 'packages/client', pkg), part = relative(base, target)
      if (!isAbsolute(part) && !part.startsWith('..')) target = resolve(root, 'packages/client-' + pkg, part)
    }
    return { find: new RegExp('^' + escape(name).replace('\\*', '(.*)') + '$'), replacement: target.replaceAll('\\', '/').replace('*', '$1') }
  })
// In the upstream workspace these exports resolve through workspace symlinks.
// Published npm artifacts omit src; resolve those test-only exports explicitly.
for (const [name, paths] of Object.entries(config.config.compilerOptions.paths as Record<string, string[]>)) {
  if (!/^@deepseek-ai\/[^/*]+$/.test(name) || !paths[0]?.includes('/src')) continue
  let source = resolve(upstream, paths[0].split('/src')[0]!, 'src')
  for (const pkg of customized) if (source === resolve(upstream, 'packages/client', pkg, 'src')) source = resolve(root, 'packages/client-' + pkg, 'src')
  alias.unshift({ find: new RegExp('^' + escape(name) + '/src/(.*)$'), replacement: source.replaceAll('\\', '/') + '/$1' })
}

export default defineConfig({
  server: { fs: { allow: [root, upstream] } },
  resolve: { alias },
  plugins: [{
    name: 'fixed-upstream-external-dependencies',
    async resolveId(id, importer) {
      // Fixed upstream cross-package fixtures; local implementation imports win.
      if (importer && id.startsWith('.') && !existsSync(resolve(dirname(importer), id))) {
        for (const pkg of customized) {
          const base = resolve(root, 'packages/client-' + pkg), part = relative(base, importer)
          if (!isAbsolute(part) && !part.startsWith('..') && part.replaceAll('\\', '/').startsWith('tests/')) {
            const target = resolve(upstream, 'packages/client', pkg, dirname(part), id)
            if (existsSync(target)) return this.resolve(target, importer, { skipSelf: true })
          }
        }
      }
      if (!importer || !importer.replaceAll('\\', '/').startsWith(upstream.replaceAll('\\', '/') + '/')
        || id.startsWith('.') || id.startsWith('/') || id.startsWith('node:') || id.includes(':') || id.startsWith('@deepseek-ai/')) return
      return this.resolve(id, resolve(root, 'package.json'), { skipSelf: true })
    },
  }, {
    name: 'standard-typescript-decorators',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?', 1)[0]!
      if (!/\.[cm]?tsx?$/.test(file) || !/^\s*@[A-Za-z_$][\w$]*/m.test(code)) return
      const output = ts.transpileModule(code, { fileName: file, compilerOptions: {
        target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ESNext,
        jsx: file.endsWith('x') ? ts.JsxEmit.ReactJSX : undefined, sourceMap: true,
      } })
      return { code: output.outputText.replace(/\n?\/\/# sourceMappingURL=.*$/u, '\n'), map: output.sourceMapText }
    },
  }],
  test: {
    maxWorkers: 2,
    include: customized.map(pkg => `packages/client-${pkg}/tests/**/*.spec.{ts,tsx}`),
    execArgv: process.allowedNodeEnvironmentFlags.has('--webstorage') ? ['--no-webstorage'] : [],
  },
})
