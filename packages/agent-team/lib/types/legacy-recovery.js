/** Explicit, durable recovery coordinator; no startup hook and no second Team service. */
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { classifyLegacyMessages } from "./legacy-mailbox.js";
const digest = (value) => createHash('sha256').update(value).digest('hex');
export class LegacyTeamRecovery {
    directory;
    constructor(directory) {
        this.directory = directory;
    }
    /** Read-only inspection also honors a previously interrupted acceptance attempt. */
    async audit(teamId, events, receivers) {
        const classified = classifyLegacyMessages(events, receivers);
        const path = join(this.directory, `${digest(teamId)}.json`);
        try {
            if ((await lstat(this.directory)).isSymbolicLink())
                throw new Error('Linked recovery journal directory refused.');
            if ((await lstat(path)).isSymbolicLink())
                throw new Error('Linked recovery journal refused.');
            const journal = JSON.parse(await readFile(path, 'utf8'));
            if (journal.version !== 1 || journal.teamId !== teamId || journal.inputHash !== digest(JSON.stringify(events))
                || JSON.stringify(journal.unknown) !== JSON.stringify(classified.unknown)
                || !Array.isArray(journal.messages) || journal.messages.length !== classified.messages.length)
                throw new Error('Recovery journal differs from preserved history.');
            for (const item of classified.messages) {
                const previous = journal.messages.find(value => value.messageId === item.messageId && value.teamId === item.teamId);
                if (!previous || previous.correlation !== digest(`${teamId}\0${item.messageId}\0${item.targetId}`)
                    || previous.senderId !== item.senderId || previous.targetId !== item.targetId
                    || !['delivered', 'pending-recovery', 'needs-confirmation'].includes(previous.status)
                    || (previous.attempt !== undefined && !['started', 'verified'].includes(previous.attempt))
                    || JSON.stringify(previous.original) !== JSON.stringify(item.original))
                    throw new Error('Invalid recovery journal entry.');
                if (item.status === 'pending-recovery' && (previous.attempt !== undefined || previous.status !== 'pending-recovery'))
                    item.status = 'needs-confirmation';
            }
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        return classified;
    }
    /** Called only by an explicit user continuation, never by Agent construction or replay. */
    async continue(teamId, events, port, authorization) {
        if (authorization?.userContinued !== true)
            throw new Error('Legacy message recovery requires explicit user continuation.');
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        if ((await lstat(this.directory)).isSymbolicLink())
            throw new Error('Linked recovery journal directory refused.');
        const key = digest(teamId), path = join(this.directory, `${key}.json`), lockPath = `${path}.lock`;
        // Cross-process exclusion. A crash leaves a lock requiring verified owner shutdown before removal.
        const lock = await open(lockPath, 'wx', 0o600);
        try {
            await lock.writeFile(JSON.stringify({ pid: process.pid, teamId }));
            await lock.sync();
            const inputHash = digest(JSON.stringify(events));
            const receiverIds = new Set();
            for (const event of events) {
                const value = event.data;
                if (typeof value?.message?.targetId === 'string')
                    receiverIds.add(value.message.targetId);
            }
            const readReceivers = async () => new Map(await Promise.all([...receiverIds].map(async (id) => [id, await port.evidence(id)])));
            const classified = classifyLegacyMessages(events, await readReceivers());
            let journal;
            try {
                if ((await lstat(path)).isSymbolicLink())
                    throw new Error('Linked recovery journal refused.');
                journal = JSON.parse(await readFile(path, 'utf8'));
                if (journal.version !== 1 || journal.teamId !== teamId || journal.inputHash !== inputHash
                    || JSON.stringify(journal.unknown) !== JSON.stringify(classified.unknown)
                    || !Array.isArray(journal.messages) || journal.messages.length !== classified.messages.length)
                    throw new Error('Recovery journal differs from preserved history.');
                for (const item of journal.messages) {
                    const original = classified.messages.find(message => message.messageId === item.messageId && message.teamId === item.teamId);
                    if (!original || item.correlation !== digest(`${teamId}\0${item.messageId}\0${item.targetId}`)
                        || original.senderId !== item.senderId || original.targetId !== item.targetId
                        || JSON.stringify(original.original) !== JSON.stringify(item.original)
                        || !['delivered', 'pending-recovery', 'needs-confirmation'].includes(item.status)
                        || (item.attempt !== undefined && !['started', 'verified'].includes(item.attempt)))
                        throw new Error('Invalid recovery journal entry.');
                }
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
                journal = { version: 1, teamId, inputHash, unknown: classified.unknown,
                    messages: classified.messages.map(item => ({ ...item, correlation: digest(`${teamId}\0${item.messageId}\0${item.targetId}`) })) };
            }
            const save = async () => {
                const temporary = `${path}.${randomUUID()}.tmp`;
                const file = await open(temporary, 'wx', 0o600);
                try {
                    await file.writeFile(JSON.stringify(journal, null, 2));
                    await file.sync();
                }
                finally {
                    await file.close();
                }
                await rename(temporary, path);
            };
            await save();
            for (const item of journal.messages) {
                const fresh = classifyLegacyMessages(events, await readReceivers()).messages
                    .find(value => value.teamId === item.teamId && value.messageId === item.messageId);
                if (fresh.status === 'needs-confirmation') {
                    item.status = fresh.status;
                    await save();
                    continue;
                }
                if (fresh.status === 'delivered') {
                    item.status = 'delivered';
                    item.attempt = 'verified';
                    await save();
                    continue;
                }
                if (item.status === 'delivered' || item.status === 'needs-confirmation')
                    continue;
                // An interrupted acceptance cannot be inferred from absence alone. Never blindly retry it.
                if (item.attempt === 'started') {
                    item.status = 'needs-confirmation';
                    await save();
                    continue;
                }
                item.attempt = 'started';
                await save();
                try {
                    await port.deliver(item, item.correlation);
                }
                catch { /* Reconcile durable acceptance before deciding whether it failed. */ }
                const after = classifyLegacyMessages(events, await readReceivers()).messages
                    .find(value => value.teamId === item.teamId && value.messageId === item.messageId);
                item.status = after.status === 'delivered' ? 'delivered' : 'needs-confirmation';
                if (item.status === 'delivered')
                    item.attempt = 'verified';
                await save();
            }
            return structuredClone(journal);
        }
        finally {
            await lock.close();
            await rm(lockPath);
        }
    }
}
//# sourceMappingURL=legacy-recovery.js.map