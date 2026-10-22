/**
 * Canonicalize one request header against the system node in force and
 * classify the model-visible prompt change.
 * @param previous - Prompt from the preceding loaded request header, when available.
 * @param event - Durable full request header to inspect.
 * @param system - Effective nonempty system prompt after loaded surface replacements; empty when removed.
 * An in-history update already presented its text at its own position, so the header reports no system change for it.
 * @returns The canonical prompt and an initial/system/tool change when it can be established.
 */
export function inspectRequestPrompt(previous, event, system) {
    const header = event.data.header;
    const rawTools = header.tools;
    const prompt = {
        config: header.config,
        system: system?.text ?? '',
        tools: Array.isArray(rawTools) ? rawTools : [],
    };
    if (previous === undefined && event.data.reason !== 'initial')
        return { prompt };
    const systemChanged = previous !== undefined && previous.system !== prompt.system && system?.update !== true;
    const toolsChanged = previous !== undefined
        && JSON.stringify(previous.tools) !== JSON.stringify(prompt.tools);
    if (previous !== undefined && !systemChanged && !toolsChanged)
        return { prompt };
    const origin = system !== undefined && (previous === undefined || systemChanged) ? system : event;
    return {
        prompt,
        change: {
            seq: origin.seq,
            time: origin.time,
            kind: previous === undefined
                ? 'initial'
                : systemChanged && toolsChanged
                    ? 'system-and-tools'
                    : systemChanged ? 'system' : 'tools',
            ...(previous === undefined ? {} : { previous }),
        },
    };
}
//# sourceMappingURL=request-inspection.js.map