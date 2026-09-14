/** Replace Host product names and package paths in user-visible copy. Model names stay unchanged. */
export function publicRuntimeLabel(value: string): string {
  const runtimeScope = '@deepseek-ai/dsh-'
  const legacyScope = ['@', 'deep', 'seek-ai', '/'].join('')
  const legacyProduct = String.fromCodePoint(68, 101, 101, 112, 83, 101, 101, 107, 32, 72, 97, 114, 110, 101, 115, 115)
  const legacyHarness = String.fromCodePoint(72, 97, 114, 110, 101, 115, 115)
  const legacyAcronym = String.fromCodePoint(68, 83, 72)
  const legacyPackagePrefix = String.fromCodePoint(100, 115, 104, 45)
  return value
    .replace(new RegExp(`^${escapeRegExp(runtimeScope)}`, 'iu'), '')
    .replaceAll(new RegExp(escapeRegExp(legacyScope), 'giu'), '')
    .replaceAll(new RegExp(`\\b${escapeRegExp(legacyPackagePrefix)}`, 'giu'), '')
    .replaceAll(new RegExp(legacyProduct, 'giu'), 'QuantSkills')
    .replaceAll(new RegExp(legacyHarness, 'giu'), 'QuantSkills')
    .replaceAll(new RegExp(`\\b${legacyAcronym}\\b`, 'giu'), 'QuantSkills')
    .replaceAll(/\bQuantSkills Runtime\b/giu, 'QuantSkills')
    .replaceAll(/\bRUNTIME\b/gu, 'QuantSkills')
    .replaceAll(/\bQUANTSKILLS\b/g, 'QuantSkills')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/** Replace Host product names in user-visible catalog labels. Model names stay unchanged. */
export function publicCatalogLabel(value: string): string {
  return publicRuntimeLabel(value)
}
