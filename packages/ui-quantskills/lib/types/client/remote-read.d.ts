/** Briefly tolerate a restarting host for read-only projections. Mutations never retry. */
export declare function retryHostRead<T>(read: () => Promise<T>): Promise<T>;
//# sourceMappingURL=remote-read.d.ts.map