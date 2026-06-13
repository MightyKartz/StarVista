import { Octokit } from '@octokit/rest';

export function createGitHubClient(token = process.env.GITHUB_TOKEN): Octokit {
  return new Octokit({
    auth: token || undefined,
    userAgent: 'StarVista data pipeline',
  });
}

export async function withGitHubRetry<T>(
  operation: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !isRetryableGitHubError(error)) {
        throw error;
      }

      const waitMs = retryDelayMs(error, attempt);
      console.warn(
        `${label} failed; retrying in ${Math.round(waitMs / 1000)}s`,
      );
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  throw lastError;
}

export function isNotFound(error: unknown): boolean {
  return statusCode(error) === 404;
}

function isRetryableGitHubError(error: unknown): boolean {
  const status = statusCode(error);
  return status === 403 || status === 429 || status >= 500;
}

function retryDelayMs(error: unknown, attempt: number): number {
  const resetHeader = responseHeaders(error)['x-ratelimit-reset'];
  const resetSeconds = resetHeader ? Number(resetHeader) : Number.NaN;

  if (Number.isFinite(resetSeconds)) {
    const resetMs = resetSeconds * 1000 - Date.now();
    if (resetMs > 0) {
      return Math.min(resetMs + 1000, 60_000);
    }
  }

  return Math.min(1000 * 2 ** attempt, 10_000);
}

function statusCode(error: unknown): number {
  if (typeof error === 'object' && error && 'status' in error) {
    return Number((error as { status: unknown }).status);
  }

  return 0;
}

function responseHeaders(error: unknown): Record<string, string | undefined> {
  if (
    typeof error === 'object' &&
    error &&
    'response' in error &&
    typeof (error as { response?: unknown }).response === 'object' &&
    (error as { response?: unknown }).response &&
    'headers' in
      ((error as { response?: unknown }).response as Record<string, unknown>)
  ) {
    return (
      error as { response: { headers: Record<string, string | undefined> } }
    ).response.headers;
  }

  return {};
}
