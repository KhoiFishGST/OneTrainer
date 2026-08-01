import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import { createViewingRunStore } from './viewing-run-store';

describe('viewingRunStore', () => {
  it('starts in live mode with no rows', () => {
    const store = createViewingRunStore(vi.fn());
    const state = get(store);

    expect(state.mode).toBe('live');
    expect(state.runKey).toBeNull();
    expect(state.rows).toEqual([]);
  });

  it('loads a past run and switches to historical mode', async () => {
    const rows = [{ step: 1, loss_train_step: 0.5 }];
    const fetchMetrics = vi.fn().mockResolvedValue({ metrics: rows });
    const store = createViewingRunStore(fetchMetrics);

    await store.showRun('run-a');

    const state = get(store);
    expect(fetchMetrics).toHaveBeenCalledWith('run-a');
    expect(state.mode).toBe('historical');
    expect(state.runKey).toBe('run-a');
    expect(state.rows).toEqual(rows);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('falls back to live mode when the run cannot be loaded', async () => {
    const fetchMetrics = vi.fn().mockRejectedValue(new Error('nope'));
    const store = createViewingRunStore(fetchMetrics);

    await store.showRun('missing');

    const state = get(store);
    expect(state.mode).toBe('live');
    expect(state.error).toBeTruthy();
    expect(state.rows).toEqual([]);
    expect(state.loading).toBe(false);
  });

  it('clears historical rows when returning to live', async () => {
    const fetchMetrics = vi.fn().mockResolvedValue({ metrics: [{ step: 1 }] });
    const store = createViewingRunStore(fetchMetrics);

    await store.showRun('run-a');
    store.showLive();

    const state = get(store);
    expect(state.mode).toBe('live');
    expect(state.runKey).toBeNull();
    expect(state.rows).toEqual([]);
    expect(state.error).toBeNull();
  });

  it('ignores a stale response when a second run is requested first', async () => {
    // Guards against the earlier request resolving last and overwriting the
    // run the user actually asked for.
    let resolveFirst: (v: any) => void = () => {};
    const fetchMetrics = vi
      .fn()
      .mockImplementationOnce(() => new Promise((r) => (resolveFirst = r)))
      .mockResolvedValueOnce({ metrics: [{ step: 2 }] });

    const store = createViewingRunStore(fetchMetrics);

    const first = store.showRun('run-a');
    const second = store.showRun('run-b');
    await second;
    resolveFirst({ metrics: [{ step: 1 }] });
    await first;

    const state = get(store);
    expect(state.runKey).toBe('run-b');
    expect(state.rows).toEqual([{ step: 2 }]);
  });
});
