/**
 * DSH 0.1.2-alpha.2 compatible builder for a dynamically loaded client plugin.
 * The resulting closure registers with the Host module loader and carries its
 * own CSS and image assets, so the npm package has no public-asset side channel.
 */
import { existsSync, globSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { isBuiltin } from 'node:module'
import { basename, dirname, relative, resolve as resolvePath, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transform } from 'lightningcss'
import type { UserConfig } from 'tsdown'

const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const GLOBAL_CSS_VIRTUAL_PREFIX = '\0dsh-global-css:'
const INLINE_CSS_VIRTUAL_PREFIX = '\0dsh-inline-css:'
const IMAGE_VIRTUAL_PREFIX = '\0dsh-image:'
const VIRTUAL_SUFFIX = '.mjs'
const INLINE_CSS_QUERY = '?inline'
const TYPES_MARKER = `${sep}lib${sep}types${sep}`

const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

const PRELOADED_CLIENT_EXTERNALS = [] as const
const INLINE_SAFE = /^(?:@deepseek-ai\/dsh-(?:file-reference|session|llm|tools|brand|deque|typert-protocol|util-crypto|util-values|util-workspace-path)(?:\/|$)|@deepseek-ai\/dsh-token-meter\/client$|@deepseek-ai\/dsh-agent-presets\/display$)/
const VENDORED_LIBRARY = /^@deepseek-ai\/(cosmokit|schemastery)(\/|$)/
const GENERATED_REMOTE = /^@deepseek-ai\/dsh-[a-z0-9]+(?:-[a-z0-9]+)*\/remote$/
const REPOSITORY_ROOT = fileURLToPath(new URL('..', import.meta.url))

interface WorkspaceManifest {
  readonly name?: string
  readonly dependencies?: Record<string, string>
  readonly peerDependencies?: Record<string, string>
  readonly optionalDependencies?: Record<string, string>
  readonly dsh?: { readonly client?: { readonly external?: unknown } }
}

interface WorkspacePackage {
  readonly directory: string
  readonly manifest: WorkspaceManifest
}

type BuildConfig = (inlineConfig: Pick<UserConfig, 'env'>) => UserConfig[]

/** Build the Node entrypoints and DSH client closure for one plugin package. */
export function clientBundle(id: string, libEntry: readonly string[]): BuildConfig {
  return ({ env }) => {
    const face = env?.DSH_BUILD_FACE
    if (face !== undefined && face !== 'host' && face !== 'client') {
      throw new Error(`DSH_BUILD_FACE must be host or client, received ${String(face)}`)
    }
    if (face === 'host') return [{ entry: '' }]
    const entry = face === 'client' ? 'lib/types/client/index.js' : 'src/client/index.ts'
    return [nodeLibraryConfig(id, libEntry), clientConfig(id, entry)]
  }
}

function nodeLibraryConfig(id: string, entries: readonly string[]): UserConfig {
  const workspace = workspacePackage(id)
  const manifest = workspace.manifest
  const names = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ])
  const externals = [...names].map(name => new RegExp(`^${escapeSpecifier(name)}(/|$)`))
  const isExternal = (specifier: string): boolean => externals.some(pattern => pattern.test(specifier))
  return {
    name: id,
    entry: entries.map(entry => resolvePath(workspace.directory, entry)),
    outDir: resolvePath(workspace.directory, 'lib'),
    tsconfig: resolvePath(workspace.directory, 'tsconfig.json'),
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: isExternal,
      alwaysBundle: specifier => !isBuiltin(specifier) && !isExternal(specifier),
    },
  }
}

function clientConfig(id: string, entry: string): UserConfig {
  const workspace = workspacePackage(id)
  const requested = clientExternals(id)
  const isRequested = (specifier: string): boolean => requested.has(specifier)
  const mode = process.env.NODE_ENV ?? 'production'
  return {
    name: `${id}/client`,
    entry: { client: resolvePath(workspace.directory, entry) },
    outDir: resolvePath(workspace.directory, 'lib'),
    tsconfig: resolvePath(workspace.directory, 'tsconfig.json'),
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: isRequested,
      alwaysBundle: specifier => !isRequested(specifier),
    },
    inputOptions: {
      resolve: {
        conditionNames: [
          mode === 'development' ? 'development' : 'production',
          'browser', 'import', 'module', 'default',
        ],
      },
    },
    define: {
      'process.env': '{}',
      'process.env.NODE_ENV': JSON.stringify(mode),
      'import.meta.env.MODE': JSON.stringify(mode),
      'import.meta.env': JSON.stringify({ MODE: mode }),
    },
    plugins: [{
      name: 'dsh-client-bundle-purity',
      resolveId(source: string) {
        if (!source.startsWith('@deepseek-ai/')) return null
        if (isRequested(source) || VENDORED_LIBRARY.test(source)) return null
        if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source) || source === '@deepseek-ai/dsh-quantskills-session/display'
          || source === '@deepseek-ai/dsh-quantskills-session/contracts') return null
        throw new Error(`client bundle purity: unsupported cross-plugin value import ${JSON.stringify(source)}`)
      },
    }, {
      name: 'dsh-image-data-url-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!/\.(?:png|webp)$/.test(source)) return null
        const file = importer === undefined ? source : sourceAssetPath(source, importer)
        return IMAGE_VIRTUAL_PREFIX + file + VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(IMAGE_VIRTUAL_PREFIX)) return null
        const file = virtualId.slice(IMAGE_VIRTUAL_PREFIX.length, -VIRTUAL_SUFFIX.length)
        this.addWatchFile(file)
        const value = await readFile(file)
        const mediaType = file.endsWith('.webp') ? 'image/webp' : 'image/png'
        return `export default ${JSON.stringify(`data:${mediaType};base64,${value.toString('base64')}`)};`
      },
    }, {
      name: 'dsh-css-modules-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.module.css')) return null
        const file = importer === undefined ? source : sourceAssetPath(source, importer)
        return CSS_VIRTUAL_PREFIX + file + VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
        const file = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -VIRTUAL_SUFFIX.length)
        this.addWatchFile(file)
        const source = await readFile(file)
        const output = transform({
          filename: file,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classes: Record<string, string> = {}
        for (const [local, value] of Object.entries(output.exports ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
          classes[local] = value.name
        }
        return styleInjectionModule(id, file, output.code.toString(), classes)
      },
    }, {
      name: 'dsh-css-text-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith(`.css${INLINE_CSS_QUERY}`)) return null
        const stylesheet = source.slice(0, -INLINE_CSS_QUERY.length)
        const file = importer === undefined ? stylesheet : sourceAssetPath(stylesheet, importer)
        return INLINE_CSS_VIRTUAL_PREFIX + file + VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(INLINE_CSS_VIRTUAL_PREFIX)) return null
        const file = virtualId.slice(INLINE_CSS_VIRTUAL_PREFIX.length, -VIRTUAL_SUFFIX.length)
        this.addWatchFile(file)
        const source = await readFile(file)
        return `export default ${JSON.stringify(transform({ filename: file, code: source, minify: true }).code.toString())};`
      },
    }, {
      name: 'dsh-css-global-inline',
      resolveId(source: string, importer: string | undefined) {
        if (!source.endsWith('.css') || source.endsWith('.module.css')) return null
        const file = importer === undefined ? source : sourceAssetPath(source, importer)
        return GLOBAL_CSS_VIRTUAL_PREFIX + file + VIRTUAL_SUFFIX
      },
      async load(virtualId: string) {
        if (!virtualId.startsWith(GLOBAL_CSS_VIRTUAL_PREFIX)) return null
        const file = virtualId.slice(GLOBAL_CSS_VIRTUAL_PREFIX.length, -VIRTUAL_SUFFIX.length)
        this.addWatchFile(file)
        const source = await readFile(file)
        return styleInjectionModule(id, file, transform({ filename: file, code: source, minify: true }).code.toString())
      },
    }],
    outputOptions: {
      entryFileNames: 'client.js',
      sourcemapPathTransform: browserSourcePath,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

function workspaceManifest(id: string): WorkspaceManifest {
  return workspacePackage(id).manifest
}

function workspacePackage(id: string): WorkspacePackage {
  for (const path of globSync('packages/*/package.json', { cwd: REPOSITORY_ROOT })) {
    const manifest = JSON.parse(readFileSync(resolvePath(REPOSITORY_ROOT, path), 'utf8')) as WorkspaceManifest
    if (manifest.name === id) {
      return {
        directory: dirname(resolvePath(REPOSITORY_ROOT, path)),
        manifest,
      }
    }
  }
  throw new Error(`no packages/*/package.json declares ${id}`)
}

function clientExternals(id: string): ReadonlySet<string> {
  const declaration = workspaceManifest(id).dsh?.client ?? {}
  if (declaration.external !== undefined && !Array.isArray(declaration.external)) {
    throw new Error(`${id} dsh.client.external must be an array of strings`)
  }
  const extra = (declaration.external ?? []) as unknown[]
  if (!extra.every(value => typeof value === 'string')) {
    throw new Error(`${id} dsh.client.external must contain only strings`)
  }
  return new Set([...PLATFORM_MODULES, ...PRELOADED_CLIENT_EXTERNALS, ...(extra as string[])])
}

function styleInjectionModule(
  id: string,
  file: string,
  css: string,
  classes?: Readonly<Record<string, string>>,
): string {
  const tagId = `${id}/${basename(file)}`
  const lines = [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(tagId)};`,
    "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {",
    "  const tag = document.createElement('style');",
    `  tag.dataset.plugin = ${JSON.stringify(id)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
    classes === undefined ? 'export {};' : `export default ${JSON.stringify(classes)};`,
  ]
  return lines.join('\n')
}

function sourceAssetPath(source: string, importer: string): string {
  const emitted = resolvePath(dirname(importer), source)
  if (existsSync(emitted)) return emitted
  const boundary = emitted.indexOf(TYPES_MARKER)
  if (boundary < 0) return emitted
  return resolvePath(emitted.slice(0, boundary), 'src', emitted.slice(boundary + TYPES_MARKER.length))
}

function browserSourcePath(source: string, sourcemapPath: string): string {
  if (!source.startsWith('.')) return source
  const physical = resolvePath(dirname(sourcemapPath), source)
  const repositoryPath = relative(REPOSITORY_ROOT, physical).split(sep).join('/')
  return repositoryPath.startsWith('packages/') ? `../../../${repositoryPath}` : source
}

function escapeSpecifier(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
