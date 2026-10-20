import { StopSequence } from "./stop-sequence.js";
/**
 * Subscribe fixed input to the same Session cancellation used by the stop button.
 * @param shortcuts - window keyboard arbitration and validated sequence interval.
 * @param sessions - live Session identities and lifecycle sources.
 * @param openTurn - stable current-turn source for a live Session binding.
 * @param uiSession - current pending-interaction status.
 * @param cancel - scoped stop operation that preserves Queue and reports failures.
 * @returns disposer releasing the input subscription, pending watches and expiry timer.
 */
export function installStopShortcut(shortcuts, sessions, openTurn, uiSession, cancel) {
    let unwatch = () => { };
    const sequence = new StopSequence(shortcuts.stopSequenceMs, () => {
        unwatch();
        unwatch = () => { };
    });
    const reset = () => { sequence.reset(); };
    const off = shortcuts.observeFixedInput((input) => {
        if (input.type === 'reset') {
            reset();
            return;
        }
        const { gesture, context } = input;
        if (gesture.code !== 'Escape' || gesture.repeat || gesture.composing || gesture.defaultPrevented
            || gesture.control || gesture.alt || gesture.shift || gesture.meta || context.modal !== null
            || context.region === 'terminal' || context.target === null) {
            reset();
            return;
        }
        const target = context.target;
        const occurrence = target.closest('[data-conversation-session]');
        const region = target.closest('[data-conversation-region]');
        if (occurrence === null || region === null || !occurrence.contains(region)
            || target.closest('[data-approval-key], iframe, .xterm, [inert]') !== null) {
            reset();
            return;
        }
        const sessionId = occurrence.dataset.conversationSession;
        const binding = sessions.binding(sessionId);
        if (binding === undefined) {
            reset();
            return;
        }
        const turnSource = openTurn(binding);
        const currentTurn = () => {
            const session = binding.session.getSnapshot();
            if (!session.running || session.removed
                || (session.subagent !== null && session.subagent.address.mode !== 'continuable')
                || uiSession.sessionStatus.getSnapshot().get(sessionId)?.pendingInteraction !== undefined)
                return undefined;
            return turnSource.getSnapshot();
        };
        const turn = currentTurn();
        if (turn === undefined) {
            reset();
            return;
        }
        input.consume();
        const stopped = sequence.press({ sessionId, turn, generation: binding, region, cancel: () => { cancel(sessionId); } });
        if (stopped)
            return;
        const changed = () => {
            if (sessions.binding(sessionId) !== binding || currentTurn() !== turn)
                reset();
        };
        const disposers = [turnSource.subscribe(changed), binding.session.subscribe(changed), uiSession.sessionStatus.subscribe(changed)];
        unwatch = () => { for (const dispose of disposers)
            dispose(); };
    });
    return () => { off(); reset(); };
}
//# sourceMappingURL=stop-shortcut.js.map