import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createUpdateAppearanceMutation, queryKeys, getSafeQueryClient } from './queries';
import { appearance } from '$lib/stores/appearance.svelte';
import { api } from './client';
import { toast } from 'svelte-sonner';
import type { AppearanceSettings } from './types';

// createUpdateAppearanceMutation() is exercised directly here (no
// LayoutContent, no rendered component) because svelte-query's createMutation
// is a plain readable store under the hood -- it needs no component context
// as long as a QueryClient is reachable. Outside a component,
// getSafeQueryClient() (see queries.ts) falls back to a module-level default
// client, which we grab the same way and reset between tests. This keeps
// coverage of the optimistic/rollback contract independent of
// LayoutContent's DOM wiring, which is covered separately by
// appearance.test.ts (the store's acceptRemote/onChange contract) and by
// e2e/motion.spec.ts (the real save -> reconcile path end to end).
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getAppearance: vi.fn(),
      putAppearance: vi.fn(),
    },
  };
});

vi.mock('svelte-sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: vi.fn(),
}));

describe('createUpdateAppearanceMutation', () => {
  const client = getSafeQueryClient();

  beforeEach(() => {
    client.clear();
    vi.mocked(api.putAppearance).mockReset();
    vi.mocked(toast.error).mockReset();
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('data-motion');
    appearance.setTheme('dark');
    appearance.setAnimations(true);
    appearance.onChange = null;
  });

  it('writes the server response through to the cache on success', async () => {
    client.setQueryData(queryKeys.appearance(), { theme: 'dark', animations: true });
    vi.mocked(api.putAppearance).mockResolvedValue({ theme: 'dark', animations: false });

    const mutation = createUpdateAppearanceMutation();
    get(mutation).mutate({ animations: false });

    await vi.waitFor(() => {
      expect(client.getQueryData(queryKeys.appearance())).toEqual({ theme: 'dark', animations: false });
    });
  });

  it('writes an optimistic value into the cache before the request resolves', async () => {
    client.setQueryData(queryKeys.appearance(), { theme: 'dark', animations: true });
    let resolvePut: (value: AppearanceSettings) => void = () => {};
    vi.mocked(api.putAppearance).mockImplementation(
      () => new Promise((resolve) => { resolvePut = resolve; })
    );

    const mutation = createUpdateAppearanceMutation();
    get(mutation).mutate({ animations: false });

    await vi.waitFor(() => {
      expect(client.getQueryData(queryKeys.appearance())).toEqual({ theme: 'dark', animations: false });
    });

    resolvePut({ theme: 'dark', animations: false });
  });

  it('rolls back the cache, reconciles the store, and raises a toast on failure', async () => {
    client.setQueryData(queryKeys.appearance(), { theme: 'dark', animations: true });
    vi.mocked(api.putAppearance).mockRejectedValue(new Error('boom'));
    const acceptRemoteSpy = vi.spyOn(appearance, 'acceptRemote');

    const mutation = createUpdateAppearanceMutation();
    get(mutation).mutate({ animations: false });

    await vi.waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Couldn't save appearance settings");
    });

    expect(client.getQueryData(queryKeys.appearance())).toEqual({ theme: 'dark', animations: true });
    expect(acceptRemoteSpy).toHaveBeenCalledWith({ theme: 'dark', animations: true });
    // The store itself (DOM + localStorage), not just the cache, must be
    // back in sync -- acceptRemote is what makes that visible.
    expect(document.documentElement.hasAttribute('data-motion')).toBe(false);
    expect(appearance.animations).toBe(true);
  });

  it('does not let a stale in-flight refetch clobber an optimistic write', async () => {
    client.setQueryData(queryKeys.appearance(), { theme: 'dark', animations: true });
    vi.mocked(api.putAppearance).mockResolvedValue({ theme: 'dark', animations: false });

    let resolveStaleRefetch: (value: AppearanceSettings) => void = () => {};
    vi.mocked(api.getAppearance).mockImplementation(
      () => new Promise((resolve) => { resolveStaleRefetch = resolve; })
    );

    // A background refetch that is still in flight when the user's own
    // change starts -- onMutate's cancelQueries must stop this from landing
    // on top of the optimistic/committed value.
    const refetchPromise = client.refetchQueries({ queryKey: queryKeys.appearance() });

    const mutation = createUpdateAppearanceMutation();
    get(mutation).mutate({ animations: false });

    await vi.waitFor(() => {
      expect(client.getQueryData(queryKeys.appearance())).toEqual({ theme: 'dark', animations: false });
    });

    resolveStaleRefetch({ theme: 'dark', animations: true });
    await refetchPromise.catch(() => {});

    expect(client.getQueryData(queryKeys.appearance())).toEqual({ theme: 'dark', animations: false });
  });
});
