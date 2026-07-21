/**
 * A lightweight, type-safe concurrency limiter compatible with both CJS and ESM environments.
 * Controls how many asynchronous tasks can execute simultaneously to protect resources like
 * database connections and network sockets.
 */
export function pLimit(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new TypeError('Expected `concurrency` to be a positive integer from 1 and up');
  }

  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      const task = queue.shift();
      if (task) task();
    }
  };

  const run = async <T>(
    fn: () => Promise<T>,
    resolve: (value: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void
  ) => {
    activeCount++;
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      next();
    }
  };

  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const task = () => run(fn, resolve, reject);
      if (activeCount < concurrency) {
        task();
      } else {
        queue.push(task);
      }
    });
  };

  return enqueue;
}
