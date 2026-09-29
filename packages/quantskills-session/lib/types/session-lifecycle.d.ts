import type { Context } from '@deepseek-ai/cordis';
import { SessionId } from '@deepseek-ai/dsh-session';
import type { SessionLifecycleRequest, SessionDeletionPreview } from './types.ts';
/** The pinned DSH patches provide ordered teardown, durable erasure and restore. */
export declare class SessionLifecycle {
    private readonly ctx;
    readonly ready: Promise<void>;
    private tail;
    private readonly journal;
    private pending;
    private pendingFiles;
    private readonly previews;
    constructor(ctx: Context, home: string);
    run(request: SessionLifecycleRequest, assertOwned: () => Promise<void>): Promise<void>;
    preview(id: SessionId, assertOwned: () => Promise<void>): Promise<SessionDeletionPreview>;
    private requireDeletionSupport;
    private recover;
    private savePending;
    private finishPending;
}
//# sourceMappingURL=session-lifecycle.d.ts.map