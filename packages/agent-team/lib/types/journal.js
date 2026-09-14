/** Serialized Team transactions over the exact live Lead Session log. */
import { foldTeam } from "./fold.js";
/** Owns per-Lead transaction order and committed Team event publication. */
export class TeamJournal {
    ctx;
    onCommit;
    tails = new Map();
    /**
     * @param ctx - Team service context with the injected Session service.
     * @param onCommit - synchronous notification after the Team event flush succeeds.
     */
    constructor(ctx, onCommit) {
        this.ctx = ctx;
        this.onCommit = onCommit;
    }
    /**
     * Fold authoritative Team state for one exact live Lead.
     * @param root - exact live Team Lead.
     * @returns current replay state selected by the Lead Team id.
     */
    state(root) {
        return foldTeam(root.id, root.session.events);
    }
    /**
     * Serialize one Lead's asynchronous mutation operation.
     * @param rootId - Lead Session identity selecting the transaction queue.
     * @param operation - complete read-check-append operation.
     * @returns the operation result.
     */
    async transact(rootId, operation) {
        const prior = this.tails.get(rootId) ?? Promise.resolve();
        const run = prior.then(operation, operation);
        const tail = run.then(() => undefined, () => undefined);
        this.tails.set(rootId, tail);
        try {
            return await run;
        }
        finally {
            if (this.tails.get(rootId) === tail)
                this.tails.delete(rootId);
        }
    }
    /**
     * Append and checkpoint one root-owned Team event before publication.
     * @param root - exact live Lead whose Session owns the event.
     * @param type - Team event discriminant.
     * @param data - payload correlated with the event type.
     */
    async appendAndFlush(root, type, data) {
        // Team events never enter the conversation surface. This narrower local
        // capability removes Session.append's conditional surface argument while
        // preserving the event-key/payload correlation.
        const append = root.session.append.bind(root.session);
        append(type, data);
        await this.ctx.sessions.flush(root.session);
        this.onCommit(root);
    }
}
//# sourceMappingURL=journal.js.map