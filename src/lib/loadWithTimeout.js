export const FEED_LOAD_TIMEOUT_MS = 10000;
export const FEED_LOAD_RETRY_DELAY_MS = 400;

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export function withTimeout(promise, milliseconds, message) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), milliseconds);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
}

/**
 * Runs loadFn() under a timeout. On timeout only, waits briefly and retries once.
 * loadFn must return a fresh promise on each call.
 */
export async function withTimeoutRetry(
  loadFn,
  milliseconds,
  message,
  retryDelayMs = FEED_LOAD_RETRY_DELAY_MS,
) {
  try {
    return await withTimeout(loadFn(), milliseconds, message);
  } catch (error) {
    if (error?.message !== message) {
      throw error;
    }
    await delay(retryDelayMs);
    return withTimeout(loadFn(), milliseconds, message);
  }
}
