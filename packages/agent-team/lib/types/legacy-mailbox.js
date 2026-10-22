const record = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
export function classifyLegacyMessages(events, receivers) {
    const queued = new Map(), receipts = new Map();
    const unknown = [], receiptRecords = [];
    for (const event of events) {
        const data = event.data;
        if (!record(data) || ![1, 2].includes(data.version) || typeof data.teamId !== 'string') {
            unknown.push(event);
            continue;
        }
        if (event.type === 'team/message/queued' && record(data.message)) {
            const message = data.message;
            if (!['id', 'senderId', 'targetId'].every(key => typeof message[key] === 'string' && message[key])) {
                unknown.push(event);
                continue;
            }
            const key = `${data.teamId}\0${message.id}`;
            if (queued.has(key)) {
                queued.get(key).status = 'needs-confirmation';
                unknown.push(event);
                continue;
            }
            queued.set(key, { teamId: data.teamId, messageId: message.id, senderId: message.senderId,
                targetId: message.targetId, status: 'pending-recovery', original: data.message });
        }
        else if (event.type === 'team/message/delivered' && typeof data.messageId === 'string' && typeof data.targetId === 'string') {
            const key = `${data.teamId}\0${data.messageId}`, targets = receipts.get(key) ?? new Set();
            targets.add(data.targetId);
            receipts.set(key, targets);
            receiptRecords.push(event);
        }
        else {
            unknown.push(event);
        }
    }
    for (const [key, item] of queued) {
        const receipt = receipts.get(key), receiver = receivers.get(item.targetId);
        const matches = [...receivers].flatMap(([target, evidence]) => evidence.accepted
            .filter(value => value.teamId === item.teamId && value.messageId === item.messageId)
            .map(value => ({ target, sender: value.senderId })));
        const accepted = matches.some(value => value.target === item.targetId && value.sender === item.senderId);
        const contradictory = matches.some(value => value.target !== item.targetId || value.sender !== item.senderId);
        if (item.status === 'needs-confirmation' || contradictory || (receipt && (receipt.size !== 1 || !receipt.has(item.targetId))))
            item.status = 'needs-confirmation';
        else if (receipt?.has(item.targetId) || accepted)
            item.status = 'delivered';
        else if (receiver?.complete !== true)
            item.status = 'needs-confirmation';
    }
    for (const event of receiptRecords) {
        const data = event.data;
        if (!queued.has(`${data.teamId}\0${data.messageId}`))
            unknown.push(event);
    }
    return { messages: [...queued.values()], unknown };
}
//# sourceMappingURL=legacy-mailbox.js.map