/** One short-lived first press, cleared before an accepted cancellation runs. */
export class StopSequence {
    intervalMs;
    release;
    first;
    timer;
    /**
     * @param intervalMs - validated maximum time between independent presses.
     * @param release - releases observations retained by the pending first press.
     */
    constructor(intervalMs, release) {
        this.intervalMs = intervalMs;
        this.release = release;
    }
    /** Clear the first press and its expiry timer. */
    reset() {
        this.first = undefined;
        clearTimeout(this.timer);
        this.timer = undefined;
        this.release();
    }
    /**
     * Accept one eligible, non-repeated Escape against freshly resolved current state.
     * @param target - live turn and actual focused input region.
     * @returns whether this press requested cancellation.
     */
    press(target) {
        const first = this.first;
        this.reset();
        if (first !== undefined && performance.now() <= first.deadline
            && first.target.sessionId === target.sessionId
            && first.target.turn === target.turn && first.target.generation === target.generation
            && first.target.region === target.region) {
            target.cancel();
            return true;
        }
        this.first = { target, deadline: performance.now() + this.intervalMs };
        this.timer = setTimeout(() => { this.reset(); }, this.intervalMs + 1);
        return false;
    }
}
//# sourceMappingURL=stop-sequence.js.map