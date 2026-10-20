/** Follow-tail ownership, saved-position restoration, and sampled reader movement. */
import { useLayoutEffect, useState } from 'react';
import { useScrollFollow } from "./use-scroll-follow.js";
const FOLLOW_THRESHOLD = 24;
const SCROLL_SAMPLE_INTERVAL_MS = 500;
/** Owns reading policy and its cancellable sampling work, without DOM access. */
export class ChatReading {
    viewport;
    store;
    state;
    onChange;
    follow;
    sampleTimer = null;
    probeFrame = null;
    sampled = null;
    constructor(viewport, store, state, onChange, follow) {
        this.viewport = viewport;
        this.store = store;
        this.state = state;
        this.onChange = onChange;
        this.follow = follow;
    }
    /**
     * Expose pending reader ownership to navigation and resize handlers.
     * @returns whether reader input still awaits interval or scrollend sampling.
     */
    get pending() { return this.sampleTimer !== null; }
    /**
     * Expose the active follow policy.
     * @returns whether content growth retains bottom-follow ownership.
     */
    get followingTail() { return this.state.followingTail; }
    /**
     * Adopt the committed Session's scroll memory.
     * @param store - scroll memory for the current Session.
     */
    setStore(store) { this.store = store; }
    /**
     * Connect history policy to settled reading observations.
     * @param sampled - receives settled reader positions.
     * @returns a disposer that disconnects only this listener.
     */
    connect(sampled) {
        this.sampled = sampled;
        return () => { if (this.sampled === sampled)
            this.sampled = null; };
    }
    /** Cancel timers and animation frames and detach the sample listener. */
    dispose() {
        this.cancelPending();
        this.sampled = null;
    }
    /** Release bottom follow and pending sampling for an explicit navigation. */
    pauseFollowing() {
        this.cancelPending();
        this.publish({ ...this.state, followingTail: false });
    }
    /**
     * Land at the current floor and clear saved reader position.
     * @param behavior - immediate positioning, or one native animation when the reader's own input moved the tail.
     */
    followTail(behavior = 'instant') {
        const landing = this.viewport.scrollToBottom(this.follow, behavior);
        if (landing === null)
            return;
        this.cancelPending();
        this.commit(landing, true, this.viewport.latestTurn);
    }
    /**
     * Follow the tail on the active fold's animation clock.
     * @returns whether a fold batch owns the tail movement instead of a separate scroll animation.
     */
    followInputFold() {
        this.cancelPending();
        return this.viewport.followInputFold(this.follow);
    }
    /**
     * Let fold batches read follow intent and commit their tail landings.
     * @returns a disposer that disconnects this reading policy from the viewport.
     */
    bindFolds() {
        return this.viewport.bindReader({
            follow: this.follow,
            landedAtTail: (landing) => {
                this.cancelPending();
                this.commit(landing, true, this.viewport.latestTurn);
            },
            pending: () => this.pending,
        });
    }
    /** Stop a native follow animation where it is; the next sampled position decides follow intent. */
    interruptFollow() {
        this.viewport.interruptFollow(this.follow);
    }
    /** Restore the Session's semantic position, or follow the tail when none is saved. */
    restore() {
        const saved = this.store.read();
        if (saved === null) {
            this.followTail();
            return;
        }
        const landing = this.viewport.restore(saved);
        if (landing === null)
            return;
        this.cancelPending();
        const following = this.follow.nearBottom(landing.metrics);
        this.commit(landing, following, following ? this.viewport.latestTurn : this.state.activeTurn, following);
        if (!this.state.followingTail && landing.position === null) {
            const position = this.viewport.capturePosition();
            if (position !== null)
                this.store.save(position);
        }
        this.refreshActiveTurn();
    }
    /**
     * Adopt a known landing without rediscovering its anchor.
     * @param landing - measured navigation result that replaces pending reader input.
     */
    acceptNavigation(landing) {
        this.cancelPending();
        const following = this.follow.nearBottom(landing.metrics);
        this.commit(landing, following, landing.turn ?? (following ? this.viewport.latestTurn : this.state.activeTurn));
    }
    /**
     * Retain reading policy while history changes the anchor's geometry.
     * @param landing - compensated position that retains the current reading policy.
     */
    preservePosition(landing) {
        this.cancelPending();
        this.commit(landing, this.state.followingTail, this.state.activeTurn);
    }
    /**
     * Handle pinned layout movement and reader arrivals at the floor immediately.
     * @param scroll - attributed scroll delivery; other reader movement remains pending until sampled.
     */
    onScroll = (scroll) => {
        // Native follow animation progress is not reader movement; scrollend settles it.
        if (this.follow.animating)
            return;
        if ((!scroll.movedByReader && this.state.followingTail)
            || (scroll.movedByReader && Math.abs(scroll.metrics.top - scroll.metrics.floor) < 1)) {
            this.followTail();
            this.sampled?.({ position: null, movedByReader: scroll.movedByReader, followingTail: true });
            return;
        }
        this.sampleTimer ??= window.setTimeout(this.flushSample, SCROLL_SAMPLE_INTERVAL_MS);
    };
    /**
     * Settle pending reader movement; only the outer scroller can finish its native follow animation.
     * @param outer - whether the event belongs to the outer scroller rather than a process body.
     */
    onScrollEnd = (outer = true) => {
        if (this.follow.animating) {
            if (!outer)
                return;
            const scroll = this.viewport.readScroll();
            if (scroll === null)
                return;
            if (this.follow.settle(scroll.metrics)) {
                this.followTail();
                return;
            }
            this.viewport.acknowledge(scroll.metrics);
            this.publish({ ...this.state, followingTail: false });
            this.refreshActiveTurn();
            return;
        }
        this.flushSample();
    };
    /** Reconcile a layout change without overriding unsampled reader input. */
    onResize() {
        if (this.pending)
            return;
        if (this.state.followingTail)
            this.followTail();
        else
            this.refreshActiveTurn();
    }
    /** Resolve the active turn from tail ownership or a coalesced reading-line probe. */
    refreshActiveTurn() {
        if (this.pending)
            return;
        if (this.state.followingTail) {
            this.publish({ ...this.state, initialized: true, activeTurn: this.viewport.latestTurn });
            return;
        }
        if (this.probeFrame !== null)
            return;
        if (typeof requestAnimationFrame !== 'function')
            this.probe();
        else
            this.probeFrame = requestAnimationFrame(this.probe);
    }
    commit(landing, followingTail, activeTurn, initialized = true) {
        if (followingTail)
            this.store.save(null);
        else if (landing.position !== null)
            this.store.save(landing.position);
        this.publish({ initialized, followingTail, activeTurn });
    }
    publish(state) {
        this.follow.setFollowing(state.followingTail);
        if (state.initialized === this.state.initialized && state.followingTail === this.state.followingTail
            && state.activeTurn === this.state.activeTurn)
            return;
        this.state = state;
        this.onChange(state);
    }
    cancelPending() {
        if (this.sampleTimer !== null)
            window.clearTimeout(this.sampleTimer);
        if (this.probeFrame !== null && typeof cancelAnimationFrame === 'function')
            cancelAnimationFrame(this.probeFrame);
        this.sampleTimer = null;
        this.probeFrame = null;
    }
    probe = () => {
        this.probeFrame = null;
        if (this.pending)
            return;
        const scroll = this.viewport.readScroll();
        if (scroll === null)
            return;
        const activeTurn = this.follow.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
        this.publish({ ...this.state, initialized: true, activeTurn });
    };
    flushSample = () => {
        if (!this.pending)
            return;
        this.cancelPending();
        const scroll = this.viewport.readScroll();
        if (scroll === null)
            return;
        const followingTail = this.follow.sample(scroll.metrics, scroll.movedByReader);
        let position = null;
        if (!scroll.movedByReader && followingTail)
            this.followTail();
        else {
            position = followingTail ? null : this.viewport.capturePosition();
            this.viewport.acknowledge(scroll.metrics);
            if (followingTail || position !== null)
                this.store.save(position);
            const activeTurn = this.follow.nearBottom(scroll.metrics) ? this.viewport.latestTurn : this.viewport.readVisibleTurn(scroll.metrics);
            this.publish({ initialized: true, followingTail, activeTurn });
        }
        this.sampled?.({ position, movedByReader: scroll.movedByReader, followingTail });
    };
}
/**
 * Retain reading policy and expose only changes in visible reading state.
 * @param viewport - turn-aware DOM operations.
 * @param store - Session-owned semantic scroll memory.
 * @param initialTurn - latest loaded turn before the first landing.
 * @returns the reading owner and its React-visible state.
 */
export function useChatReading(viewport, store, initialTurn) {
    const [state, setState] = useState(() => ({
        initialized: false,
        followingTail: store.read() === null,
        activeTurn: initialTurn,
    }));
    const follow = useScrollFollow(state.followingTail, FOLLOW_THRESHOLD + 1);
    const [reading] = useState(() => new ChatReading(viewport, store, state, setState, follow));
    useLayoutEffect(() => { reading.setStore(store); }, [reading, store]);
    useLayoutEffect(() => reading.bindFolds(), [reading]);
    useLayoutEffect(() => () => { reading.dispose(); }, [reading]);
    return { reading, state };
}
//# sourceMappingURL=use-chat-reading.js.map