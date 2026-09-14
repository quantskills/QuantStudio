import { describe, expect, it } from 'vitest'
import { validateGitTree } from '../src/tree.ts'

const object = '1'.repeat(40)
const limits = {
  maxFiles: 4,
  maxTotalBytes: 64,
  maxFileBytes: 32,
  maxDepth: 4,
  maxPathBytes: 64,
}

function row(path: string, bytes = 4, mode = '100644', type = 'blob'): string {
  return `${mode} ${type} ${object} ${type === 'commit' ? '-' : bytes}\t${path}\0`
}

describe('QuantSkills Git tree admission', () => {
  it('accepts a bounded regular tree with the exact root declaration', () => {
    const tree = validateGitTree(`${row('SKILL.md')}${row('src/run.py', 8, '100755')}`, 'SKILL.md', limits)
    expect(tree).toMatchObject({ fileCount: 2, totalBytes: 12 })
    expect(tree.treeDigest).toMatch(/^sha256:[a-f0-9]{64}$/)
  })

  it('rejects symlinks, gitlinks, traversal, Windows devices, and case collisions', () => {
    for (const output of [
      `${row('SKILL.md')}${row('link', 4, '120000')}`,
      `${row('SKILL.md')}${row('vendor', 0, '160000', 'commit')}`,
      `${row('SKILL.md')}${row('../outside')}`,
      `${row('SKILL.md')}${row('.GIT/config')}`,
      `${row('SKILL.md')}${row('NUL.txt')}`,
      `${row('SKILL.md')}${row('COM¹.txt')}`,
      `${row('SKILL.md')}${row('CONIN$')}`,
      `${row('SKILL.md')}${row('Readme.md')}${row('README.md')}`,
    ]) {
      expect(() => validateGitTree(output, 'SKILL.md', limits))
        .toThrow(expect.objectContaining({ code: 'INSTALL_INVALID_TREE' }))
    }
  })

  it('applies complete file-count, per-file, total-byte, depth, and path-byte limits', () => {
    const cases: Array<[string, Partial<typeof limits>]> = [
      [`${row('SKILL.md')}${row('a')}`, { maxFiles: 1 }],
      [row('SKILL.md', 5), { maxFileBytes: 4 }],
      [`${row('SKILL.md', 4)}${row('a', 4)}`, { maxTotalBytes: 7 }],
      [`${row('SKILL.md')}${row('a/b/c/d')}`, { maxDepth: 3 }],
      [`${row('SKILL.md')}${row('long-name')}`, { maxPathBytes: 8 }],
    ]
    for (const [output, override] of cases) {
      expect(() => validateGitTree(output, 'SKILL.md', { ...limits, ...override }))
        .toThrow(expect.objectContaining({ code: 'INSTALL_LIMIT_EXCEEDED' }))
    }
  })

  it('rejects a missing kind-specific root declaration and incomplete output', () => {
    expect(() => validateGitTree(row('README.md'), 'SKILL.md', limits))
      .toThrow(expect.objectContaining({ code: 'INSTALL_INVALID_TREE' }))
    expect(() => validateGitTree(row('SKILL.md').slice(0, -1), 'SKILL.md', limits))
      .toThrow(expect.objectContaining({ code: 'INSTALL_INVALID_TREE' }))
  })
})
