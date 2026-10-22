import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import { TeamId, TeamMessageId, LegacyTeamRecovery } from '@deepseek-ai/dsh-agent-team';
import { queueHostSubagentPrompt } from '@deepseek-ai/dsh-subagent/internal';
import { inspectSession } from "./session-storage.js";
function accepted(events) {
    const found = [];
    for (const event of events) {
        const messages = event.type === 'user/message' ? [event.data]
            : event.type === 'agent/inbox/spliced' ? event.data.inserted : [];
        for (const message of messages)
            if (message.source.kind === 'team-message') {
                found.push({ teamId: message.source.teamId, messageId: message.source.messageId, senderId: message.source.senderId });
            }
    }
    return found;
}
export async function recoverLegacyTeam(ctx, directory, request, signal) {
    const lead = ctx.agents.get(request.sessionId);
    if (!lead || lead.session.header.parentSession !== undefined)
        throw new Error('请先打开原专家团主会话。');
    // The official projection validates durable roster ownership and all task transitions.
    const members = new Set(ctx.agentTeams.listMembers(lead).map(member => String(member.id)));
    members.add(lead.id);
    const events = lead.session.snapshotEvents().filter(event => event.type.startsWith('team/message/'));
    const port = {
        evidence: async (id) => {
            if (!members.has(id))
                return { complete: false, accepted: [] };
            try {
                const live = ctx.sessions.get(SessionId(id));
                if (live && !await ctx.sessions.flush(live))
                    return { complete: false, accepted: [] };
                const stored = await inspectSession(ctx.sessionPersistence, SessionId(id), signal);
                if (stored.meta.id !== id || (id !== lead.id && stored.meta.parentSession !== lead.id))
                    return { complete: false, accepted: [] };
                return { complete: true, accepted: accepted(stored.events.slice(stored.inheritedEventCount)) };
            }
            catch {
                signal.throwIfAborted();
                return { complete: false, accepted: [] };
            }
        },
        deliver: async (message) => {
            signal.throwIfAborted();
            if (message.teamId !== lead.id || !members.has(message.senderId) || !members.has(message.targetId))
                throw new Error('Legacy message membership differs.');
            const original = message.original;
            const source = { kind: 'team-message', teamId: TeamId(message.teamId), messageId: TeamMessageId(message.messageId),
                senderId: SessionId(message.senderId), senderName: original.senderName };
            if (message.targetId === lead.id)
                lead.inject(createUserMessage({ source, content: original.content }));
            else
                await queueHostSubagentPrompt(ctx.subagents, lead, SessionId(message.targetId), original.content, source, signal);
            const receiver = ctx.sessions.get(SessionId(message.targetId));
            if (!receiver || !await ctx.sessions.flush(receiver))
                throw new Error('Receiver acceptance could not be checkpointed.');
        },
    };
    const recovery = new LegacyTeamRecovery(directory);
    const result = request.continuePending === true
        ? await recovery.continue(lead.id, events, port, { userContinued: true })
        : await recovery.audit(lead.id, events, new Map(await Promise.all([...members].map(async (id) => [id, await port.evidence(id)]))));
    return { delivered: result.messages.filter(item => item.status === 'delivered').length,
        pending: result.messages.filter(item => item.status === 'pending-recovery').length,
        uncertain: result.messages.filter(item => item.status === 'needs-confirmation').length, unknownEvents: result.unknown.length };
}
//# sourceMappingURL=legacy-team-recovery.js.map