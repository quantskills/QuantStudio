/** Separate a leading YAML header for display only; never change the saved declaration. */
export function declarationDisplay(markdown) {
    const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/u.exec(markdown);
    return match ? { body: markdown.slice(match[0].length), metadata: match[1] } : { body: markdown };
}
//# sourceMappingURL=declaration-display.js.map