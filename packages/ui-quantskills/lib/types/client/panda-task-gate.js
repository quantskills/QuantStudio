/** Panda readiness gate for every QuantSkills-owned launch. */
/** User-actionable failure for a launch blocked by the configured Panda login policy. */
export class PandaLoginRequiredError extends Error {
    constructor(message = '该任务需要 PandaData 登录。请登录后重新启动任务。') {
        super(message);
        this.name = 'PandaLoginRequiredError';
    }
}
/** User-actionable failure for a launch blocked by PandaData execution readiness. */
export class PandaRuntimeRequiredError extends Error {
    constructor(message = 'PandaData 执行环境尚未通过验证。请修复运行环境后重新启动任务。') {
        super(message);
        this.name = 'PandaRuntimeRequiredError';
    }
}
/**
 * Hold at most one QuantSkills launch and resume it only after the Host
 * connector publishes authenticated, data-verified, executable state.
 */
export class PandaTaskGate {
    port;
    policy;
    requestIntervention;
    clearPending;
    pending;
    disposed = false;
    /**
     * @param port - connector refresh and state reads.
     * @param policy - current durable preference reads.
     * @param requestIntervention - opens login or runtime repair and publishes the pending label.
     * @param clearPending - clears the pending label after settlement.
     */
    constructor(port, policy, requestIntervention, clearPending) {
        this.port = port;
        this.policy = policy;
        this.requestIntervention = requestIntervention;
        this.clearPending = clearPending;
    }
    /**
     * Run only when authentication, read-only data, and script execution are ready.
     * @param label - user-facing description of the blocked launch.
     * @param task - exact launch operation to run once.
     * @returns the launch result.
     */
    async run(label, task) {
        if (this.disposed)
            throw new Error('Panda task gate is disposed.');
        await this.port.describe();
        if (this.port.connection().status === 'not-ready')
            await this.port.bootstrap();
        const connection = this.port.connection();
        if (isPandaTaskReady(connection))
            return task();
        this.cancel(new PandaLoginRequiredError('新的 PandaData 任务替换了先前等待登录的任务。'));
        const intervention = connection.status === 'connected' ? 'runtime' : 'login';
        this.requestIntervention(label, intervention);
        if (!this.policy.resumeAfterLogin()) {
            this.clearPending();
            if (intervention === 'runtime')
                throw new PandaRuntimeRequiredError();
            throw new PandaLoginRequiredError();
        }
        return new Promise((resolve, reject) => {
            this.pending = {
                label,
                run: task,
                resolve: (value) => { resolve(value); },
                reject,
            };
        });
    }
    /** Resume the pending launch after the connector publishes login success. */
    connectionChanged() {
        if (this.disposed || !isPandaTaskReady(this.port.connection()))
            return;
        const pending = this.pending;
        if (pending === undefined)
            return;
        this.pending = undefined;
        this.clearPending();
        void pending.run().then(pending.resolve, (cause) => {
            pending.reject(cause instanceof Error ? cause : new Error(String(cause)));
        });
    }
    /**
     * Cancel the pending launch without affecting any task already running.
     * @param reason - user-actionable cancellation reason.
     */
    cancel(reason = new PandaLoginRequiredError('等待登录的任务已取消。')) {
        const pending = this.pending;
        if (pending === undefined)
            return;
        this.pending = undefined;
        this.clearPending();
        pending.reject(reason);
    }
    /** Reject pending work and refuse future launches. */
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.cancel(new Error('Panda task gate was disposed.'));
    }
}
function isPandaTaskReady(connection) {
    return connection.status === 'connected'
        && connection.dataReadiness === 'verified'
        && connection.executionReadiness === 'ready';
}
//# sourceMappingURL=panda-task-gate.js.map