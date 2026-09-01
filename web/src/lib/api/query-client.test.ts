import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { createAppQueryClient, shouldRetryQuery } from './query-client';

describe('shouldRetryQuery', () => {
  it('never retries client errors such as an expired session', () => {
    expect(shouldRetryQuery(0, new ApiError(401, 'Authentication required'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(403, 'Forbidden'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, 'Not Found'))).toBe(false);
  });

  it('retries server errors a bounded number of times', () => {
    const error = new ApiError(503, 'Service Unavailable');
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it('retries transport failures that carry no status', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('createAppQueryClient', () => {
  it('applies the shared defaults', () => {
    const defaults = createAppQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(1000 * 60);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.retry).toBe(shouldRetryQuery);
  });
});
