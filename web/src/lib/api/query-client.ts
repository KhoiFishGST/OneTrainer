import { QueryClient } from '@tanstack/svelte-query';
import { ApiError } from './client';

const MAX_RETRIES = 1;

/**
 * Retrying a 4xx cannot succeed — the request was wrong, not unlucky. Retrying
 * a 401 in particular used to fire three backed-off requests per query while
 * the user sat on the login page.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}
