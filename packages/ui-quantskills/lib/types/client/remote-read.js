/** Briefly tolerate a restarting host for read-only projections. Mutations never retry. */
export async function retryHostRead(read) {
    for (let attempt = 0;; attempt++) {
        try {
            return await read();
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (attempt >= 2 || !/HTTP\s+(?:404|502|503|504)\b|Failed to fetch|NetworkError|connection (?:closed|reset)/i.test(message))
                throw error;
            await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 300 : 900));
        }
    }
}
//# sourceMappingURL=remote-read.js.map