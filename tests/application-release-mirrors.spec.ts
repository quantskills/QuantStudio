import { describe, expect, it } from 'vitest'
import {
  compareApplicationReleaseRefs,
  parseApplicationReleaseRefs,
} from '../scripts/verify-application-release-mirrors.mjs'

describe('application release mirror verification', () => {
  it('uses peeled annotated-tag commits and ignores prerelease tags', () => {
    const refs = parseApplicationReleaseRefs([
      '1111111111111111111111111111111111111111\trefs/heads/main',
      '2222222222222222222222222222222222222222\trefs/tags/v0.1.17',
      '3333333333333333333333333333333333333333\trefs/tags/v0.1.17^{}',
      '4444444444444444444444444444444444444444\trefs/tags/v0.1.18-rc.1',
    ].join('\n'))

    expect(refs.main).toBe('1111111111111111111111111111111111111111')
    expect([...refs.tags]).toEqual([
      ['v0.1.17', '3333333333333333333333333333333333333333'],
    ])
  })

  it('reports branch, missing-tag, and tag-commit mismatches', () => {
    const github = parseApplicationReleaseRefs([
      '1111111111111111111111111111111111111111\trefs/heads/main',
      '2222222222222222222222222222222222222222\trefs/tags/v0.1.16',
      '3333333333333333333333333333333333333333\trefs/tags/v0.1.17',
    ].join('\n'))
    const gitee = parseApplicationReleaseRefs([
      '9999999999999999999999999999999999999999\trefs/heads/main',
      '8888888888888888888888888888888888888888\trefs/tags/v0.1.16',
    ].join('\n'))

    expect(compareApplicationReleaseRefs(github, gitee)).toEqual([
      'main differs: GitHub 1111111111111111111111111111111111111111, Gitee 9999999999999999999999999999999999999999',
      'v0.1.16 differs: GitHub 2222222222222222222222222222222222222222, Gitee 8888888888888888888888888888888888888888',
      'v0.1.17 exists only on GitHub',
    ])
  })
})
