export async function inspectSession(persistence, id, signal) {
    const handle = await persistence.open(id, 'read', signal ? { signal } : undefined);
    try {
        const { events } = await handle.read(0, undefined, signal ? { signal } : undefined);
        return { meta: handle.header, inheritedEventCount: handle.inheritedEventCount, events };
    }
    finally {
        await handle.close();
    }
}
export async function listSessionHeaders(persistence, signal) {
    return (await persistence.list(signal ? { signal } : undefined)).map(item => item.header);
}
//# sourceMappingURL=session-storage.js.map