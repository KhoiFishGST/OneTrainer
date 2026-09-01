import { writable, type Readable } from 'svelte/store';
import type { GpuStat, TrainingMetric, TrainingSample, TrainingStatus } from '../api/types';

export interface TrainingStoreState {
  status: TrainingStatus;
  metrics: TrainingMetric[];
  samples: TrainingSample[];
  gpuStats: GpuStat | null;
}

const INITIAL_STATUS: TrainingStatus = {
  state: 'IDLE',
  step: 0,
  max_steps: 0,
  epoch: 0,
  max_epochs: 0,
  speed_its: 0,
  elapsed_seconds: 0,
  eta_seconds: 0,
  error_message: null,
  has_snapshot: false,
};

// States in which a run is under way. Entering one of these from outside the
// set is what marks a new run; moving between them is not.
const RUNNING_STATES = ['STARTING', 'TRAINING', 'PAUSED'];

export interface TrainingStore extends Readable<TrainingStoreState> {
  setStatus: (status: Partial<TrainingStatus>) => void;
  setMetrics: (metrics: TrainingMetric[]) => void;
  setSamples: (samples: TrainingSample[]) => void;
  setGpuStats: (stats: GpuStat) => void;
  applyEvent: (event: any) => void;
  reset: () => void;
}

export function createTrainingStore(maxMetrics = 10000): TrainingStore {
  const { subscribe, set, update } = writable<TrainingStoreState>({
    status: { ...INITIAL_STATUS },
    metrics: [],
    samples: [],
    gpuStats: null,
  });

  const setStatus = (status: Partial<TrainingStatus>) => {
    update((s) => ({
      ...s,
      status: { ...s.status, ...status },
    }));
  };

  const setMetrics = (metrics: TrainingMetric[]) => {
    update((s) => ({
      ...s,
      metrics: metrics.slice(-maxMetrics),
    }));
  };

  const setSamples = (samples: TrainingSample[]) => {
    update((s) => ({
      ...s,
      samples: [...samples],
    }));
  };

  const setGpuStats = (stats: GpuStat) => {
    update((s) => ({
      ...s,
      gpuStats: { ...stats },
    }));
  };

  const extractPayload = (event: any) => {
    const raw = event.data !== undefined ? event.data : event;
    if (typeof raw !== 'object' || raw === null) return {};
    const { type, event: evtName, stream_id, seq, ...rest } = raw;
    return rest;
  };

  const applyEvent = (event: any) => {
    if (!event) return;
    const type = event.type || event.event;
    const payload = extractPayload(event);

    if (type === 'training_state') {
      // A new run starts back at step 0, so the previous run's points have to
      // go. The server clears its own buffers on start, but this store fills
      // from the event stream and is only refilled on mount -- so without this
      // a new run's early steps landed on top of the last run's, and the chart
      // (which keys points by step) kept showing the stale tail until the new
      // run passed the old one's last step.
      //
      // Keyed on the transition, not the event: training_state also fires on
      // every progress tick, and PAUSED -> TRAINING is a resume, not a new run.
      update((s) => {
        const wasRunning = RUNNING_STATES.includes(s.status.state);
        const isRunning = RUNNING_STATES.includes(payload?.state);
        const startingFresh = isRunning && !wasRunning;
        return {
          ...s,
          status: { ...s.status, ...payload },
          metrics: startingFresh ? [] : s.metrics,
          samples: startingFresh ? [] : s.samples,
        };
      });
    } else if (type === 'training_metric') {
      update((s) => {
        const nextMetrics = [...s.metrics, payload];
        if (nextMetrics.length > maxMetrics) {
          nextMetrics.shift();
        }
        return { ...s, metrics: nextMetrics };
      });
    } else if (type === 'training_sample') {
      update((s) => ({
        ...s,
        samples: [...s.samples, payload],
      }));
    } else if (type === 'gpu_stat') {
      setGpuStats(payload);
    }
  };

  const reset = () => {
    set({
      status: { ...INITIAL_STATUS },
      metrics: [],
      samples: [],
      gpuStats: null,
    });
  };

  return {
    subscribe,
    setStatus,
    setMetrics,
    setSamples,
    setGpuStats,
    applyEvent,
    reset,
  };
}

export const trainingStore = createTrainingStore();
