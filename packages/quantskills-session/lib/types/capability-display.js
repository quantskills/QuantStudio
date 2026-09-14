/** Prefer a declared Chinese title while preserving stable IDs and frozen revisions. */
export function capabilityDisplayName(name, declaration = '') {
    if (/[\u3400-\u9fff]/u.test(name))
        return name.replace(/\s+Team\b/gu, '团队');
    const heading = declaration.match(/^#\s+(.+)$/mu)?.[1];
    const candidate = heading?.replace(/\*\*|`/gu, '').replace(/\s*[（(][^）)]*[）)]\s*/gu, ' ').replace(/^Agent\s+Team\s+Lead\s*[—–:-]\s*/iu, '').trim();
    if (candidate && /[\u3400-\u9fff]/u.test(candidate))
        return candidate.slice(0, 80);
    return name;
}
export function capabilitySummary(declaration) {
    return declaration.replace(/^---\s*\n[\s\S]*?\n---\s*\n/u, '').replace(/^#{1,6}\s+.*$/gmu, '').replace(/\*\*|`/gu, '').replace(/\s+/gu, ' ').trim();
}
//# sourceMappingURL=capability-display.js.map