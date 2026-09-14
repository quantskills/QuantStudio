/** Durable Session-message acceptance checks shared by provisioning and mailbox recovery. */
/** Fold the durable inbox suffix into the messages still awaiting a claim. */
function pendingInboxMessages(events) {
    const inbox = { 'next-turn': [], 'next-step': [] };
    for (const event of events) {
        if (event.type !== 'agent/inbox/spliced')
            continue;
        const pending = inbox[event.data.target];
        pending.splice(event.data.start, event.data.removedCount ?? 0, ...event.data.inserted);
    }
    return [...inbox['next-turn'], ...inbox['next-step']];
}
/**
 * Test whether one message is model-visible or still durably pending.
 * @param events - one Session's non-inherited event suffix.
 * @param predicate - identity check for the accepted message.
 * @returns whether history or the current inbox contains a match.
 */
export function messageAccepted(events, predicate) {
    return events.some(event => event.type === 'user/message' && predicate(event.data))
        || pendingInboxMessages(events).some(predicate);
}
//# sourceMappingURL=session-message.js.map