import { describe, it, expect } from 'vitest'
import { pandaSdkCompatibility } from '../src/compatibility.ts'
import { parsePandaRelease } from '../src/runtime.ts'

const version = '1.0.6'
const digest = '5437a54546946ca5dd3a24ec074d05342518f22310f04403e01adb4d034ce15f'

describe('PandaData 1.0.6 admission', () => {
  it('admits the exact approved wheel', () => {
    const release = pandaSdkCompatibility(version)!
    expect(release).toBeDefined()
    expect(release.wheelSha256).toBe(digest)
    const candidate = { info: { version }, releases: { [version]: [{
      filename: `panda_data-${version}-py3-none-any.whl`, packagetype: 'bdist_wheel',
      url: release.wheelURL, yanked: false, digests: { sha256: digest },
    }] } }
    expect(parsePandaRelease(candidate).version).toBe(version)
    candidate.releases[version][0]!.digests.sha256 = '0'.repeat(64)
    expect(() => parsePandaRelease(candidate)).toThrow()
  })
  it('retains older admitted environments for rollback and adoption', () => {
    expect(pandaSdkCompatibility('0.0.12')).toBeDefined()
    expect(pandaSdkCompatibility('0.0.14')).toBeDefined()
  })
})
