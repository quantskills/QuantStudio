import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export const APPLICATION_RELEASE_REPOSITORIES = Object.freeze({
  github: 'https://github.com/quantskills/QuantStudio.git',
  gitee: 'https://gitee.com/quantskills/QuantStudio.git',
})

const STABLE_TAG = /^refs\/tags\/(v\d+\.\d+\.\d+)(\^\{\})?$/

/**
 * Parse one git ls-remote response into the update refs owned by the application.
 * @param {string} output - raw git ls-remote output.
 * @returns {{ readonly main: string | undefined, readonly tags: ReadonlyMap<string, string> }} normalized refs.
 */
export function parseApplicationReleaseRefs(output) {
  let main
  const directTags = new Map()
  const peeledTags = new Map()
  for (const line of output.split(/\r?\n/u)) {
    if (line.length === 0) continue
    const [commit, ref] = line.split(/\s+/u)
    if (commit === undefined || ref === undefined) continue
    if (ref === 'refs/heads/main') {
      main = commit
      continue
    }
    const match = STABLE_TAG.exec(ref)
    if (match === null) continue
    const [, tag, peeled] = match
    if (tag === undefined) continue
    if (peeled === undefined) directTags.set(tag, commit)
    else peeledTags.set(tag, commit)
  }
  const tags = new Map()
  for (const [tag, commit] of directTags) tags.set(tag, peeledTags.get(tag) ?? commit)
  return { main, tags }
}

/**
 * Describe every main/tag mismatch between two application repositories.
 * @param {{ readonly main: string | undefined, readonly tags: ReadonlyMap<string, string> }} github - GitHub refs.
 * @param {{ readonly main: string | undefined, readonly tags: ReadonlyMap<string, string> }} gitee - Gitee refs.
 * @returns {readonly string[]} mismatch descriptions.
 */
export function compareApplicationReleaseRefs(github, gitee) {
  const mismatches = []
  if (github.main === undefined) mismatches.push('GitHub main is missing')
  if (gitee.main === undefined) mismatches.push('Gitee main is missing')
  if (github.main !== undefined && gitee.main !== undefined && github.main !== gitee.main) {
    mismatches.push(`main differs: GitHub ${github.main}, Gitee ${gitee.main}`)
  }
  const names = new Set([...github.tags.keys(), ...gitee.tags.keys()])
  for (const tag of [...names].sort()) {
    const githubCommit = github.tags.get(tag)
    const giteeCommit = gitee.tags.get(tag)
    if (githubCommit === undefined) mismatches.push(`${tag} exists only on Gitee`)
    else if (giteeCommit === undefined) mismatches.push(`${tag} exists only on GitHub`)
    else if (githubCommit !== giteeCommit) {
      mismatches.push(`${tag} differs: GitHub ${githubCommit}, Gitee ${giteeCommit}`)
    }
  }
  return mismatches
}

async function readRemoteRefs(repository) {
  const output = await runGit([
    'ls-remote',
    '--heads',
    '--tags',
    repository,
    'refs/heads/main',
    'refs/tags/v*',
  ])
  return parseApplicationReleaseRefs(output)
}

async function runGit(args) {
  return await new Promise((resolveRun, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    const stdout = []
    const stderr = []
    child.stdout.on('data', chunk => stdout.push(chunk))
    child.stderr.on('data', chunk => stderr.push(chunk))
    child.once('error', reject)
    child.once('close', code => {
      if (code === 0) {
        resolveRun(Buffer.concat(stdout).toString('utf8'))
        return
      }
      reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `git exited with code ${String(code)}`))
    })
  })
}

async function main() {
  const [github, gitee] = await Promise.all([
    readRemoteRefs(APPLICATION_RELEASE_REPOSITORIES.github),
    readRemoteRefs(APPLICATION_RELEASE_REPOSITORIES.gitee),
  ])
  const mismatches = compareApplicationReleaseRefs(github, gitee)
  if (mismatches.length > 0) {
    throw new Error(`Application release mirrors are not synchronized:\n- ${mismatches.join('\n- ')}`)
  }
  console.log(
    `Application release mirrors match: main ${github.main?.slice(0, 12)}, ${github.tags.size} stable tag(s).`,
  )
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main()
}
