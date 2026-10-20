import { conversationContextKey } from "../contract/conversation.js";
import { ConversationGroupStore } from "./group-store.js";
import { ConversationLocationIndex, } from "./location-index.js";
const PUBLICATION_RANK = {
    none: 0,
    'animation-frame': 1,
    immediate: 2,
};
const LOCATION_DATA_SCOPES = ['step', 'turn'];
function emptyLocationData() {
    return { step: null, turn: null };
}
function maximumPublication(left, right) {
    return PUBLICATION_RANK[left] >= PUBLICATION_RANK[right] ? left : right;
}
function startSeq(context) {
    return context.startSeq;
}
function insertionIndex(contexts, seq) {
    let low = 0;
    let high = contexts.length;
    while (low < high) {
        const middle = low + Math.floor((high - low) / 2);
        const candidate = contexts[middle];
        if (candidate !== undefined && candidate.startSeq < seq)
            low = middle + 1;
        else
            high = middle;
    }
    return low;
}
function contextSnapshot(context) {
    return {
        key: context.key,
        kind: context.kind,
        id: context.id,
        matches: context.matches,
        start: context.start,
        state: context.state,
        current: context.current,
    };
}
function mergeMatches(key, additions, existing) {
    const merged = [];
    let added = 0;
    let current = 0;
    while (added < additions.length || current < existing.length) {
        const left = additions[added];
        const right = existing[current];
        if (left !== undefined && right !== undefined && left.event.seq === right.event.seq) {
            throw new Error(`conversation Context ${key} received duplicate Match ${left.event.seq}`);
        }
        if (right === undefined || (left !== undefined && left.event.seq < right.event.seq)) {
            merged.push(left);
            added++;
        }
        else {
            merged.push(right);
            current++;
        }
    }
    return merged;
}
function conversationMatch(input, role, location) {
    return { event: input.event, role, location };
}
const NO_GROUPS = { entries: () => [], forTarget: () => undefined };
/**
 * Session-owned incremental engine that assembles business Contexts from a
 * contiguous Event window and materializes registered view snapshots.
 */
export class ConversationNodeAssembler {
    eventDefinitions;
    viewDefinitions;
    groupDefinitions;
    contexts = new Map();
    contextsByKind = new Map();
    contextsBySeq = new Map();
    contextsByTarget = new Map();
    inputs = new Map();
    locationIndex = new ConversationLocationIndex();
    dirty = new Set();
    dirtyByTarget = new Map();
    revised = new Set();
    dependents = new Map();
    views = new Map();
    groups = new Map();
    pendingGroupStores = new Set();
    activeTargets = new Set();
    /** Matches of the event in dispatch, kept by index; dispatch is not reentrant and reuses both arrays. */
    matchedDefinitions = [];
    matchedResults = [];
    hasMore = false;
    replacePending = true;
    timelineDirty = true;
    /**
     * @param eventDefinitions - live Event Definition registry.
     * @param viewDefinitions - live view builder registry.
     * @param groupDefinitions - optional registered grouping rules, independent of presentation modes.
     */
    constructor(eventDefinitions, viewDefinitions, groupDefinitions = NO_GROUPS) {
        this.eventDefinitions = eventDefinitions;
        this.viewDefinitions = viewDefinitions;
        this.groupDefinitions = groupDefinitions;
        this.resetViewBuilders();
    }
    /**
     * Read the current open turn without activating a View.
     * @returns the latest turn number when its start is loaded and it remains open, otherwise undefined.
     */
    openTurn() {
        const snapshot = this.locationIndex.snapshot();
        const latest = snapshot.turnOrder.at(-1);
        const turn = latest === undefined ? undefined : snapshot.turns.get(latest);
        return turn?.status === 'open' && turn.start !== undefined ? turn.turn : undefined;
    }
    /**
     * Replace the complete loaded window after open, resync, or gap repair.
     * @param entries - complete contiguous window.
     * @param hasMore - whether older history remains outside the window.
     * @returns immediate publication request.
     */
    replaceWindow(entries, hasMore) {
        this.contexts.clear();
        this.contextsByKind.clear();
        this.contextsBySeq.clear();
        this.contextsByTarget.clear();
        this.inputs.clear();
        this.dirty.clear();
        this.dirtyByTarget.clear();
        this.revised.clear();
        this.dependents.clear();
        this.hasMore = hasMore;
        const sorted = [...entries].sort((left, right) => left.event.seq - right.event.seq);
        for (const entry of sorted)
            this.inputs.set(entry.event.seq, entry);
        this.locationIndex.rebuild(sorted);
        this.timelineDirty = true;
        for (const entry of sorted)
            this.matchInput(entry);
        this.replayDependencies();
        this.revised.clear();
        for (const context of this.contexts.values())
            this.markDirty(context);
        this.replacePending = true;
        return 'immediate';
    }
    /**
     * Add one contiguous live tail event without scanning existing Contexts.
     * @param record - appended Session event entry.
     * @returns highest requested publication cadence.
     */
    append(record) {
        const event = record.event;
        if (this.inputs.has(event.seq))
            return 'none';
        if (this.revised.size > 0)
            this.revised.clear();
        this.inputs.set(event.seq, record);
        let publication = 'none';
        if (event.type !== 'assistant/live-chunk' && isLocationBoundary(event.type)) {
            const previousTimeline = this.locationIndex.snapshot();
            const changed = this.locationIndex.appendBoundary(event);
            if (this.locationIndex.snapshot() !== previousTimeline) {
                this.timelineDirty = true;
                publication = 'immediate';
            }
            this.replayContexts(this.refreshMatchLocations(changed));
            if (changed.size > 0)
                publication = 'immediate';
        }
        else {
            this.locationIndex.appendNonBoundary(event);
        }
        publication = maximumPublication(publication, this.matchInput(record));
        if (this.replayRevisedDependents())
            publication = 'immediate';
        if (this.revised.size > 0)
            this.revised.clear();
        return publication;
    }
    /**
     * Retire one Assistant attempt's transient matches and apply its optional durable settlement.
     * Empty Contexts retain their keys and published nodes until the loaded window is rebuilt;
     * Definitions may hide those nodes when no start remains instead of withdrawing their identities.
     * @param attemptId - process-local attempt whose transient presentation ended.
     * @param entry - durable message or attempt event committed for the stream.
     * @returns highest requested publication cadence.
     */
    settleAssistant(attemptId, entry) {
        this.revised.clear();
        const retired = [...this.inputs.values()].filter((candidate) => (candidate.type === 'transient'
            && candidate.event.data.attemptId === attemptId));
        const retiredSeqs = new Set(retired.map(candidate => candidate.event.seq));
        const affected = new Set();
        for (const seq of retiredSeqs) {
            this.inputs.delete(seq);
            for (const context of this.contextsBySeq.get(seq) ?? [])
                affected.add(context);
            this.contextsBySeq.delete(seq);
        }
        for (const context of affected) {
            context.matches = context.matches.filter(match => !retiredSeqs.has(match.event.seq));
        }
        this.locationIndex.removeAssistantTransients(retired.map(candidate => candidate.event));
        let publication = retired.length === 0 ? 'none' : 'immediate';
        if (entry !== undefined && !this.inputs.has(entry.event.seq)) {
            this.inputs.set(entry.event.seq, entry);
            this.locationIndex.insertAssistantSettlement(entry.event);
            const pending = new Map();
            publication = maximumPublication(publication, this.collectInput(entry, pending));
            this.applyPendingMatches(pending, affected);
        }
        this.replayContexts(affected);
        if (this.replayRevisedDependents())
            publication = 'immediate';
        this.revised.clear();
        return publication;
    }
    /**
     * Add an older page while preserving existing Context and view identities.
     * @param entries - newly loaded older Events.
     * @param hasMore - whether history still precedes the expanded window.
     * @returns highest requested publication cadence.
     */
    prepend(entries, hasMore) {
        this.revised.clear();
        let publication = 'none';
        const previousHasMore = this.hasMore;
        const fresh = entries
            .filter(entry => !this.inputs.has(entry.event.seq))
            .sort((left, right) => left.event.seq - right.event.seq);
        for (const entry of fresh)
            this.inputs.set(entry.event.seq, entry);
        this.hasMore = hasMore;
        const previousTimeline = this.locationIndex.snapshot();
        const changedLocations = this.locationIndex.rebuild(this.sortedInputs());
        if (this.locationIndex.snapshot() !== previousTimeline)
            this.timelineDirty = true;
        const affected = this.refreshMatchLocations(changedLocations);
        const pending = new Map();
        for (const entry of fresh) {
            publication = maximumPublication(publication, this.collectInput(entry, pending));
        }
        this.applyPendingMatches(pending, affected);
        this.replayContexts(affected);
        if ((this.revised.size > 0 || previousHasMore !== hasMore) && this.replayDependencies()) {
            publication = 'immediate';
        }
        if (changedLocations.size > 0)
            publication = 'immediate';
        this.revised.clear();
        return publication;
    }
    /**
     * Rebuild against the current Registry set after a low-frequency plugin change.
     * @returns immediate publication request.
     */
    rebuildRegistry() {
        this.resetViewBuilders();
        return this.replaceWindow(this.sortedInputs(), this.hasMore);
    }
    /**
     * Materialize dirty Contexts and advance every active view builder.
     * @returns whether any view snapshot was rebuilt or incrementally applied.
     */
    flush() {
        if (!this.replacePending && this.dirty.size === 0 && !this.timelineDirty)
            return false;
        if (this.replacePending) {
            this.replaceLocationData();
            const updated = [];
            const changedTurns = this.locationIndex.takeChangedTurns();
            for (const target of this.activeTargets) {
                const view = this.views.get(target);
                if (view === undefined)
                    continue;
                this.updateView(view, true, this.buildTargetNodes(target, this.contextsByTarget.get(target)), changedTurns);
                updated.push(view);
            }
            this.replacePending = false;
            this.dirty.clear();
            this.dirtyByTarget.clear();
            this.timelineDirty = false;
            return this.publishViews(updated);
        }
        const updated = [];
        if (this.applyDirtyLocationData())
            this.timelineDirty = true;
        const changedTurns = this.locationIndex.takeChangedTurns();
        const timelineDirty = this.timelineDirty;
        for (const target of this.activeTargets) {
            const view = this.views.get(target);
            if (view === undefined)
                continue;
            const builder = view.builder;
            if (builder === undefined)
                continue;
            const upserts = this.buildTargetUpserts(target, this.dirtyByTarget.get(target));
            if (upserts.length === 0 && !timelineDirty)
                continue;
            this.updateView(view, false, upserts, changedTurns);
            updated.push(view);
        }
        this.dirty.clear();
        this.dirtyByTarget.clear();
        this.timelineDirty = false;
        return this.publishViews(updated);
    }
    /**
     * Add one target to the monotonic active set and materialize its current snapshot.
     * Pending Context work is flushed before the first complete replacement.
     * @param target - registered or subsequently registered view target.
     * @returns whether any active target snapshot changed.
     */
    activateTarget(target) {
        const view = this.views.get(target);
        if (this.activeTargets.has(target))
            return false;
        const published = this.flush();
        this.activeTargets.add(target);
        if (view === undefined)
            return published;
        this.replaceView(view);
        this.publishViews([view]);
        return true;
    }
    /**
     * Read the latest snapshot of a registered target.
     * @param target - registered view target.
     * @returns target snapshot, or undefined before registration or activation.
     */
    snapshot(target) {
        return this.views.get(target)?.snapshot;
    }
    get(target) {
        return this.snapshot(target);
    }
    grouped(target) {
        return this.groups.get(target)?.store;
    }
    /**
     * Read targets whose owners classify their latest snapshot as visible activity.
     * @returns target ids contributing visible activity.
     */
    activityTargets() {
        const active = new Set();
        for (const target of this.activeTargets) {
            const view = this.views.get(target);
            if (view === undefined)
                continue;
            if (view.isActive?.(view.snapshot) === true)
                active.add(view.target);
        }
        return active;
    }
    sortedInputs() {
        return [...this.inputs.values()].sort((left, right) => left.event.seq - right.event.seq);
    }
    matchInput(input) {
        // oxlint-disable-next-line typescript/unbound-method -- dispatchInput supplies the assembler receiver
        return this.dispatchInput(input, this.acceptMatch);
    }
    collectInput(input, pending) {
        return this.dispatchInput(input, (definition, id, match) => {
            const key = conversationContextKey(definition.kind, id);
            const matches = pending.get(key) ?? [];
            matches.push({ definition, id, match });
            pending.set(key, matches);
            return definition.publication?.(match) ?? 'immediate';
        });
    }
    dispatchInput(input, accept) {
        const event = input.event;
        let startMatch;
        let updateMatch;
        let location;
        const matchFor = (role) => {
            location ??= this.locationIndex.locationOf(event);
            return role === 'start'
                ? startMatch ??= conversationMatch(input, role, location)
                : updateMatch ??= conversationMatch(input, role, location);
        };
        const definitions = this.matchedDefinitions;
        const results = this.matchedResults;
        definitions.length = 0;
        results.length = 0;
        const routes = this.eventDefinitions.forEvent?.(event.type);
        if (routes === undefined) {
            for (const definition of this.eventDefinitions.entries()) {
                const result = definition.match(event);
                if (result === null)
                    continue;
                definitions.push(definition);
                results.push(result);
            }
        }
        else {
            for (const { definition, match } of routes) {
                const result = match(event);
                if (result === null)
                    continue;
                definitions.push(definition);
                results.push(result);
            }
        }
        // Claims are resolved before any acceptance, so the outcome does not depend on registration order.
        let claims;
        for (let index = 0; index < results.length; index++) {
            if (results[index].exclusive !== true)
                continue;
            const definition = definitions[index];
            const target = definition.target;
            if (target === undefined) {
                throw new Error(`conversation Definition "${definition.kind}" claims ${event.type} at seq ${String(event.seq)} without a target`);
            }
            const claimant = claims?.get(target);
            if (claimant !== undefined) {
                throw new Error(`conversation Definitions "${claimant}" and "${definition.kind}" both claim ${event.type} at seq ${String(event.seq)} on target "${target}"`);
            }
            (claims ??= new Map()).set(target, definition.kind);
        }
        let firstTarget;
        let secondTarget;
        let otherTargets;
        let publication = 'none';
        for (let index = 0; index < results.length; index++) {
            const definition = definitions[index];
            const result = results[index];
            const target = definition.target;
            if (target !== undefined && result.exclusive !== true && claims?.has(target) === true)
                continue;
            // Inline target tracking avoids an additional closure allocation for each event.
            if (target !== undefined && target !== firstTarget && target !== secondTarget) {
                if (firstTarget === undefined)
                    firstTarget = target;
                else if (secondTarget === undefined)
                    secondTarget = target;
                else
                    (otherTargets ??= new Set()).add(target);
            }
            publication = maximumPublication(publication, accept.call(this, definition, result.id, matchFor(result.role)));
        }
        const fallback = this.eventDefinitions.fallbackEntry();
        const target = fallback?.target;
        if (fallback !== undefined && target !== undefined
            && target !== firstTarget && target !== secondTarget && otherTargets?.has(target) !== true) {
            const result = fallback.match(event);
            if (result !== null) {
                publication = maximumPublication(publication, accept.call(this, fallback, result.id, matchFor(result.role)));
            }
        }
        return publication;
    }
    createContext(definition, id, key) {
        const context = {
            key,
            kind: definition.kind,
            id,
            definition,
            startSeq: undefined,
            start: undefined,
            matches: [],
            state: undefined,
            revision: 0,
            current: new Map(),
            locationData: emptyLocationData(),
            dependencies: new Map(),
        };
        this.contexts.set(key, context);
        this.indexTargetContext(context);
        return context;
    }
    acceptMatch(definition, id, match) {
        const latest = this.contextsByKind.get(definition.kind)?.at(-1);
        const key = latest?.id === id ? latest.key : conversationContextKey(definition.kind, id);
        let context = this.contexts.get(key);
        context ??= this.createContext(definition, id, key);
        const starting = match.role === 'start' && context.start === undefined;
        const previous = context.matches.at(-1);
        if (previous !== undefined && previous.event.seq >= match.event.seq) {
            throw new Error(`conversation Context ${key} received non-appended Match ${match.event.seq}`);
        }
        if (starting && context.matches.length > 0) {
            throw new Error(`conversation Context ${key} received an update before its start Match`);
        }
        context.matches.push(match);
        if (starting) {
            context.startSeq = match.event.seq;
            context.start = match;
            this.indexStartedContext(context);
        }
        let owners = this.contextsBySeq.get(match.event.seq);
        if (owners === undefined) {
            owners = [];
            this.contextsBySeq.set(match.event.seq, owners);
        }
        owners.push(context);
        if (starting) {
            this.replayContext(context);
        }
        else if (context.state !== undefined) {
            const typed = contextSnapshot(context);
            context.state = requireState(definition, 'update', definition.update(typed, match));
            context.revision++;
            this.revised.add(context);
        }
        this.markDirty(context);
        return definition.publication?.(match) ?? 'immediate';
    }
    applyPendingMatches(pending, affected) {
        for (const [key, entries] of pending) {
            const first = entries[0];
            if (first === undefined)
                continue;
            let context = this.contexts.get(key);
            context ??= this.createContext(first.definition, first.id, key);
            const additions = entries
                .map((entry) => {
                if (entry.definition !== context.definition || entry.id !== context.id) {
                    throw new Error(`conversation Context ${key} received inconsistent Definition identity`);
                }
                let owners = this.contextsBySeq.get(entry.match.event.seq);
                if (owners === undefined) {
                    owners = [];
                    this.contextsBySeq.set(entry.match.event.seq, owners);
                }
                owners.push(context);
                return entry.match;
            })
                .sort((left, right) => left.event.seq - right.event.seq);
            context.matches = mergeMatches(context.key, additions, context.matches);
            affected.add(context);
            this.markDirty(context);
        }
    }
    replayContexts(contexts) {
        this.refreshStarts(contexts);
        const ordered = [...contexts].sort((left, right) => (left.startSeq ?? Number.POSITIVE_INFINITY) - (right.startSeq ?? Number.POSITIVE_INFINITY));
        for (const context of ordered) {
            if (context.start === undefined) {
                context.state = undefined;
                this.replaceDependencies(context, new Map());
                context.revision++;
                this.revised.add(context);
                this.markDirty(context);
                continue;
            }
            this.replayContext(context);
        }
    }
    refreshStarts(contexts) {
        const changed = new Set();
        const startsByKind = new Map();
        for (const context of contexts) {
            const start = context.matches.find(match => match.role === 'start');
            if (start === context.start)
                continue;
            context.start = start;
            context.startSeq = start?.event.seq;
            changed.add(context);
            const starts = startsByKind.get(context.kind) ?? [];
            if (start !== undefined)
                starts.push(context);
            startsByKind.set(context.kind, starts);
        }
        for (const [kind, starts] of startsByKind) {
            const existing = this.contextsByKind.get(kind) ?? [];
            this.contextsByKind.set(kind, existing.filter(context => !changed.has(context)));
            this.indexStartedContexts(kind, starts);
        }
    }
    replayContext(context) {
        const start = context.start;
        if (start === undefined) {
            context.state = undefined;
            return;
        }
        if (context.matches[0] !== start) {
            throw new Error(`conversation Context ${context.key} received an update before its start Match`);
        }
        const dependencies = new Map();
        const reader = this.readerFor(start.event.seq, dependencies);
        context.state = undefined;
        context.state = requireState(context.definition, 'start', context.definition.start(contextSnapshot(context), start, reader));
        this.replaceDependencies(context, dependencies);
        for (let index = 1; index < context.matches.length; index++) {
            const match = context.matches[index];
            if (match === undefined)
                continue;
            const typed = contextSnapshot(context);
            context.state = requireState(context.definition, 'update', context.definition.update(typed, match));
        }
        context.revision++;
        this.revised.add(context);
        this.markDirty(context);
    }
    indexTargetContext(context) {
        const target = context.definition.target;
        if (target === undefined)
            return;
        const contexts = this.contextsByTarget.get(target) ?? new Set();
        contexts.add(context);
        this.contextsByTarget.set(target, contexts);
    }
    markDirty(context) {
        if (this.dirty.has(context))
            return;
        this.dirty.add(context);
        const target = context.definition.target;
        if (target === undefined || !this.activeTargets.has(target))
            return;
        let contexts = this.dirtyByTarget.get(target);
        if (contexts === undefined) {
            contexts = new Set();
            this.dirtyByTarget.set(target, contexts);
        }
        contexts.add(context);
    }
    replaceDependencies(context, dependencies) {
        for (const dependency of context.dependencies.values()) {
            if (dependency.key === undefined)
                continue;
            const current = this.dependents.get(dependency.key);
            current?.delete(context);
            if (current?.size === 0)
                this.dependents.delete(dependency.key);
        }
        context.dependencies = dependencies;
        for (const dependency of dependencies.values()) {
            if (dependency.key === undefined)
                continue;
            const current = this.dependents.get(dependency.key) ?? new Set();
            current.add(context);
            this.dependents.set(dependency.key, current);
        }
    }
    replayRevisedDependents() {
        if (this.dependents.size === 0)
            return false;
        const pending = [...this.revised];
        const affected = new Set();
        for (let index = 0; index < pending.length; index++) {
            const dependency = pending[index];
            if (dependency === undefined)
                continue;
            for (const dependent of this.dependents.get(dependency.key) ?? []) {
                if (affected.has(dependent))
                    continue;
                affected.add(dependent);
                pending.push(dependent);
            }
        }
        if (affected.size > 0)
            this.replayContexts(affected);
        return affected.size > 0;
    }
    readerFor(beforeSeq, dependencies) {
        return {
            previous: (kind) => {
                const predecessor = this.previousContext(kind, beforeSeq);
                dependencies.set(kind, {
                    kind,
                    key: predecessor?.key,
                    revision: predecessor?.revision,
                    windowGap: predecessor === undefined && this.hasMore,
                });
                if (predecessor?.state === undefined)
                    return undefined;
                const seq = startSeq(predecessor);
                if (seq === undefined)
                    return undefined;
                return {
                    key: predecessor.key,
                    kind: predecessor.kind,
                    id: predecessor.id,
                    startSeq: seq,
                    state: predecessor.state,
                    matches: predecessor.matches,
                };
            },
        };
    }
    previousContext(kind, beforeSeq) {
        const candidates = this.contextsByKind.get(kind) ?? [];
        const indexBefore = insertionIndex(candidates, beforeSeq);
        for (let index = indexBefore - 1; index >= 0; index--) {
            const candidate = candidates[index];
            if (candidate?.state !== undefined)
                return candidate;
        }
        return undefined;
    }
    /** Insert one newly discovered start into its Definition's ordered predecessor index. */
    indexStartedContext(context) {
        const seq = context.startSeq;
        if (seq === undefined)
            return;
        const candidates = this.contextsByKind.get(context.kind) ?? [];
        const previous = candidates.at(-1);
        if (previous === undefined || previous.startSeq < seq)
            candidates.push(context);
        else
            candidates.splice(insertionIndex(candidates, seq), 0, context);
        this.contextsByKind.set(context.kind, candidates);
    }
    indexStartedContexts(kind, additions) {
        if (additions.length === 0)
            return;
        const sorted = [...additions].sort((left, right) => left.startSeq - right.startSeq);
        const existing = this.contextsByKind.get(kind) ?? [];
        const merged = [];
        let before = 0;
        let added = 0;
        while (before < existing.length || added < sorted.length) {
            const left = existing[before];
            const right = sorted[added];
            if (right === undefined || (left !== undefined && left.startSeq < right.startSeq)) {
                merged.push(left);
                before++;
            }
            else {
                merged.push(right);
                added++;
            }
        }
        this.contextsByKind.set(kind, merged);
    }
    replayDependencies() {
        let replayed = false;
        const ordered = [...this.contexts.values()]
            .filter(context => startSeq(context) !== undefined)
            .sort((left, right) => startSeq(left) - startSeq(right));
        for (const context of ordered) {
            if (context.state === undefined || context.dependencies.size === 0)
                continue;
            const before = startSeq(context);
            if (before === undefined)
                continue;
            let changed = false;
            for (const dependency of context.dependencies.values()) {
                const current = this.previousContext(dependency.kind, before);
                const windowGap = current === undefined && this.hasMore;
                if (current?.key !== dependency.key
                    || current?.revision !== dependency.revision
                    || windowGap !== dependency.windowGap) {
                    changed = true;
                    break;
                }
            }
            if (changed) {
                this.replayContext(context);
                replayed = true;
            }
        }
        return replayed;
    }
    refreshMatchLocations(changedSeqs) {
        const affected = new Set();
        if (changedSeqs.size === 0)
            return affected;
        for (const seq of changedSeqs) {
            for (const context of this.contextsBySeq.get(seq) ?? [])
                affected.add(context);
        }
        for (const context of affected) {
            let start = context.start;
            const matches = context.matches.map((match) => {
                if (!changedSeqs.has(match.event.seq))
                    return match;
                if (match.role === 'start') {
                    const refreshed = {
                        ...match,
                        location: this.locationIndex.locationOf(match.event),
                    };
                    if (match === start)
                        start = refreshed;
                    return refreshed;
                }
                return { ...match, location: this.locationIndex.locationOf(match.event) };
            });
            context.matches = matches;
            context.start = start;
        }
        return affected;
    }
    buildNode(context, target) {
        if (context.definition.target !== target || context.definition.buildViewNode === undefined)
            return null;
        const node = context.definition.buildViewNode(contextSnapshot(context));
        if (node === null)
            return null;
        if (node.key !== context.key) {
            throw new Error(`conversation Definition "${context.kind}" returned unstable key "${node.key}"; expected "${context.key}"`);
        }
        if (node.target !== target) {
            throw new Error(`conversation Definition "${context.kind}" returned target "${node.target}" while building "${target}"`);
        }
        return node;
    }
    replaceView(view) {
        this.updateView(view, true, this.buildTargetNodes(view.target, this.contextsByTarget.get(view.target)), []);
    }
    updateView(view, replacing, nodes, changedTurns) {
        const builder = view.builder ?? view.definition.create();
        const definition = view.groupDefinition;
        if (definition !== undefined && builder.groupInput === undefined) {
            throw new Error(`conversation group target "${view.target}" requires builder.groupInput()`);
        }
        view.builder = builder;
        const timeline = this.locationIndex.snapshot();
        const snapshot = replacing
            ? builder.replace({ nodes, timeline, changedTurns })
            : builder.apply({ upserts: nodes, timeline, changedTurns });
        if (definition !== undefined && builder.groupInput !== undefined) {
            let context = this.groups.get(view.target);
            const initial = context === undefined;
            if (context === undefined) {
                context = { definition, state: definition.create(), store: new ConversationGroupStore() };
            }
            const input = builder.groupInput();
            context.state = definition.update(context, input);
            const change = definition.buildGroups(context);
            if ((initial || input.kind === 'replace')
                && (change === null || change.entries === undefined || change.groups.kind !== 'replace')) {
                throw new Error(`conversation group target "${view.target}" requires complete grouping for replacement input`);
            }
            if (change !== null) {
                context.store.prepareAndInstall(change, input.readNode);
                this.pendingGroupStores.add(context.store);
            }
            this.groups.set(view.target, context);
        }
        view.snapshot = snapshot;
    }
    publishViews(updated) {
        const changed = updated.length > 0 || this.pendingGroupStores.size > 0;
        const stores = [...this.pendingGroupStores];
        this.pendingGroupStores.clear();
        for (const view of updated)
            view.builder?.publish?.();
        for (const store of stores)
            store.publish();
        this.locationIndex.publishData();
        return changed;
    }
    buildTargetNodes(target, contexts) {
        const nodes = [];
        for (const context of contexts ?? []) {
            const node = this.buildNode(context, target);
            context.current.set(target, node);
            if (node !== null)
                nodes.push(node);
        }
        return nodes;
    }
    buildTargetUpserts(target, contexts) {
        const upserts = [];
        for (const context of contexts ?? []) {
            const previous = context.current.get(target) ?? null;
            const node = this.buildNode(context, target);
            if (node === null && previous !== null) {
                throw new Error(`conversation Definition "${context.kind}" withdrew materialized target "${target}"; return the same key with hidden visibility instead`);
            }
            context.current.set(target, node);
            if (node !== null)
                upserts.push(node);
        }
        return upserts;
    }
    buildLocationData(context, scope, previous) {
        if (context.definition.buildLocationData === undefined)
            return null;
        const data = context.definition.buildLocationData(contextSnapshot(context), scope, previous);
        if (data === null)
            return null;
        if (data.kind !== scope) {
            throw new Error(`conversation Definition "${context.kind}" published ${data.kind} data through its ${scope} scope`);
        }
        if (data.key !== context.kind) {
            throw new Error(`conversation Definition "${context.kind}" published Location data key "${data.key}"; expected its owned kind`);
        }
        if (!Number.isSafeInteger(data.turn) || data.turn < 0) {
            throw new Error(`conversation Definition "${context.kind}" published invalid turn ${data.turn}`);
        }
        if (data.kind === 'step' && (!Number.isSafeInteger(data.step) || data.step < 0)) {
            throw new Error(`conversation Definition "${context.kind}" published invalid step ${String(data.step)}`);
        }
        return data;
    }
    replaceLocationData() {
        const entries = [];
        for (const scope of LOCATION_DATA_SCOPES) {
            for (const context of this.contexts.values()) {
                const data = this.buildLocationData(context, scope, context.locationData[scope]);
                context.locationData[scope] = data;
                if (data !== null)
                    entries.push({ owner: context.key, data });
            }
            // Turn publishers may read Step data from this same flush, so each phase
            // installs the cumulative replacement before the next phase builds.
            this.locationIndex.replaceData(entries);
        }
    }
    applyDirtyLocationData() {
        let changed = false;
        for (const scope of LOCATION_DATA_SCOPES) {
            const changes = [];
            for (const context of this.dirty) {
                const previous = context.locationData[scope];
                const next = this.buildLocationData(context, scope, previous);
                if (previous === next)
                    continue;
                context.locationData[scope] = next;
                changes.push({ owner: context.key, previous, next });
            }
            changed = this.locationIndex.applyData(changes) || changed;
        }
        return changed;
    }
    resetViewBuilders() {
        const definitions = this.viewDefinitions.entries();
        const targets = new Set(definitions.map(definition => definition.target));
        for (const [target, group] of this.groups) {
            if (!targets.has(target) || this.groupDefinitions.forTarget(target) !== group.definition) {
                group.store.clear();
                this.pendingGroupStores.add(group.store);
                this.groups.delete(target);
            }
        }
        this.views.clear();
        for (const definition of definitions) {
            const view = {
                target: definition.target,
                definition,
                groupDefinition: this.groupDefinitions.forTarget(definition.target),
                isActive: definition.isActive === undefined
                    ? undefined
                    : snapshot => definition.isActive?.(snapshot) === true,
                builder: undefined,
                snapshot: undefined,
            };
            this.views.set(definition.target, view);
        }
        this.replacePending = true;
    }
}
function isLocationBoundary(type) {
    return type === 'turn/start' || type === 'turn/end' || type === 'step/start' || type === 'step/end';
}
function requireState(definition, phase, state) {
    if (state === undefined) {
        throw new Error(`conversation Definition "${definition.kind}" returned undefined from ${phase}()`);
    }
    return state;
}
//# sourceMappingURL=assembler.js.map