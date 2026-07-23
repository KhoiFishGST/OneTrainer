import { describe, it, expect } from 'vitest';
import { createTrainingStore } from './training-store';

describe('trainingStore', () => {
  it('initializes with IDLE state and empty metric buffer', () => {
    const store = createTrainingStore();
    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.status.state).toBe('IDLE');
    expect(state.metrics).toEqual([]);
    expect(state.samples).toEqual([]);
    expect(state.gpuStats).toBeNull();
  });

  it('updates state on training_state event', () => {
    const store = createTrainingStore();
    store.applyEvent({
      type: 'training_state',
      state: 'TRAINING',
      step: 10,
      max_steps: 100,
    });
    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.status.state).toBe('TRAINING');
    expect(state.status.step).toBe(10);
    expect(state.status.max_steps).toBe(100);
  });

  it('buffers metrics on training_metric event', () => {
    const store = createTrainingStore();
    store.applyEvent({
      type: 'training_metric',
      step: 1,
      loss: 0.5,
      lr: 0.001,
    });
    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.metrics).toHaveLength(1);
    expect(state.metrics[0]).toEqual({ step: 1, loss: 0.5, lr: 0.001 });
  });

  it('buffers samples on training_sample event', () => {
    const store = createTrainingStore();
    store.applyEvent({
      type: 'training_sample',
      id: 'sample_1',
      step: 10,
      url: '/api/training/samples/sample_1/image',
    });
    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.samples).toHaveLength(1);
    expect(state.samples[0].id).toBe('sample_1');
  });

  it('updates gpu stats on gpu_stat event', () => {
    const store = createTrainingStore();
    store.applyEvent({
      type: 'gpu_stat',
      vram_used: 4096,
      vram_total: 16384,
      utilization: 85.5,
      temperature: 65,
    });
    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.gpuStats).toEqual({
      vram_used: 4096,
      vram_total: 16384,
      utilization: 85.5,
      temperature: 65,
    });
  });

  it('handles events with event property instead of type', () => {
    const store = createTrainingStore();
    store.applyEvent({
      event: 'training_state',
      data: { state: 'PAUSED', step: 50 },
    });
    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.status.state).toBe('PAUSED');
    expect(state.status.step).toBe(50);
  });

  it('allows manual state, metrics, samples, and gpu updates', () => {
    const store = createTrainingStore();
    store.setStatus({ state: 'COMPLETED', step: 100 });
    store.setMetrics([{ step: 1, loss: 0.1 }]);
    store.setSamples([{ id: 's1' }]);
    store.setGpuStats({ vram_used: 2048 });

    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.status.state).toBe('COMPLETED');
    expect(state.metrics).toEqual([{ step: 1, loss: 0.1 }]);
    expect(state.samples).toEqual([{ id: 's1' }]);
    expect(state.gpuStats).toEqual({ vram_used: 2048 });
  });

  it('resets state correctly', () => {
    const store = createTrainingStore();
    store.setStatus({ state: 'TRAINING', step: 50 });
    store.reset();

    let state: any;
    store.subscribe((s) => (state = s))();
    expect(state.status.state).toBe('IDLE');
    expect(state.status.step).toBe(0);
    expect(state.metrics).toEqual([]);
    expect(state.samples).toEqual([]);
    expect(state.gpuStats).toBeNull();
  });
});
