/**
 * Runs a list of async task functions with a max concurrency limit.
 */
export async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
    const results: T[] = new Array(tasks.length);
    let currentIndex = 0;
    
    const workers = new Array(Math.min(concurrency, tasks.length)).fill(null).map(async () => {
        while (currentIndex < tasks.length) {
            const index = currentIndex++;
            try {
                results[index] = await tasks[index]();
            } catch (err) {
                // Return or store error if needed, but continue remaining tasks
                console.error(`Task ${index} failed:`, (err as any)?.message);
            }
        }
    });

    await Promise.all(workers);
    return results.filter(r => r !== undefined);
}
