/**
 * Compare immutable Turn-process specifications by their published fields.
 * @param left - previous specification.
 * @param right - next specification.
 * @returns whether both values describe the same process presentation.
 */
export function sameTurnProcessSpec(left, right) {
    return left.turn === right.turn
        && left.controlAnchorSeq === right.controlAnchorSeq
        && left.processStartSeq === right.processStartSeq
        && left.answerAnchorSeq === right.answerAnchorSeq
        && left.answerStep === right.answerStep
        && left.inlineReasoning === right.inlineReasoning
        && left.messageCount === right.messageCount
        && left.toolCallCount === right.toolCallCount
        && left.subagentCount === right.subagentCount;
}
/**
 * Recognize the shipped subagent delegation name and its configured variants.
 * Control tools use distinct names such as `send_message` and `list_agents`.
 * @param name - durable Tool-call name.
 * @returns whether the call creates or forks a subagent.
 */
export function isSubagentDelegationTool(name) {
    return name === 'subagent' || name.startsWith('subagent_');
}
/**
 * Keep live, stopped, and failed Turns open.
 * @param node - Node carrying the owning Turn.
 * @returns whether whole-Turn collapse is unavailable.
 */
export function turnProcessAlwaysOpen(node) {
    const location = node?.location;
    if (location?.kind !== 'turn' && location?.kind !== 'step')
        return false;
    const reason = location.turn.end?.data.reason.kind;
    return location.turn.status === 'open' || reason === 'aborted' || reason === 'interrupted' || reason === 'error';
}
//# sourceMappingURL=turn-process.js.map