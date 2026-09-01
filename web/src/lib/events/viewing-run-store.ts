import { writable, type Readable } from 'svelte/store';
import type { TrainingMetric } from '../api/types';

export interface ViewingRunState {
  mode: 'live' | 'historical';
  runKey: string | null;
  rows: TrainingMetric[];
  loading: boolean;
  error: string | null;
}

export interface ViewingRunStore extends Readable<ViewingRunState> {
  showLive: () => void;
  showRun: (runKey: string) => Promise<void>;
}

const INITIAL: ViewingRunState = {
  mode: 'live',
  runKey: null,
  rows: [],
  loading: false,
  error: null,
};

type FetchMetrics = (runKey: string) => Promise<{ metrics: TrainingMetric[] }>;

export function createViewingRunStore(fetchMetrics: FetchMetrics): ViewingRunStore {
  const { subscribe, set, update } = writable<ViewingRunState>({ ...INITIAL });

  // Only the most recent request may write results; an earlier one resolving
  // late must not overwrite the run the user actually asked for.
  let requestId = 0;

  const showLive = () => {
    requestId += 1;
    set({ ...INITIAL });
  };

  const showRun = async (runKey: string) => {
    const id = ++requestId;
    update((s) => ({ ...s, loading: true, error: null, runKey }));

    try {
      const response = await fetchMetrics(runKey);
      if (id !== requestId) return;
      set({
        mode: 'historical',
        runKey,
        rows: response?.metrics ?? [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      if (id !== requestId) return;
      set({
        ...INITIAL,
        error: err?.detail?.message || err?.message || 'Could not load metrics for this run',
      });
    }
  };

  return { subscribe, showLive, showRun };
}

export const viewingRunStore = createViewingRunStore(async (runKey: string) => {
  const { api } = await import('../api/client');
  return api.getGalleryRunMetrics(runKey);
});
