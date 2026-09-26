/**
 * fetchWithRetry.ts
 * Shared HTTP helper for target/judge API calls: adds a request timeout
 * (so a hung free-tier endpoint doesn't stall an attempt indefinitely) and
 * automatic retry-with-backoff specifically for 429 (rate limit) responses,
 * since Groq/Gemini free tiers are exactly where you're most likely to hit
 * those under real testing.
 *
 * Does NOT retry on other 4xx/5xx statuses — those are real errors (bad
 * request, invalid API key, etc.) that a retry won't fix, so surfacing them
 * immediately is more useful than silently retrying.
 */

const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000;

export interface FetchWithRetryOptions extends RequestInit {
  timeoutMs?: number;
  maxRetries?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxRetries = MAX_RETRIES, ...fetchOptions } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.status === 429 && attempt < maxRetries) {
        // Respect Retry-After if the provider sends one, otherwise exponential backoff.
        const retryAfterHeader = res.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : BASE_BACKOFF_MS * 2 ** attempt;
        await sleep(retryAfterMs);
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;

      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort && attempt < maxRetries) {
        // Timed out — retry with backoff, same as a rate limit, rather than
        // failing the whole attempt on one slow response.
        await sleep(BASE_BACKOFF_MS * 2 ** attempt);
        continue;
      }
      if (isAbort) {
        throw new Error(
          `Request to ${url} timed out after ${timeoutMs}ms (${maxRetries} retries exhausted)`
        );
      }
      throw err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Request to ${url} failed after ${maxRetries} retries`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}