import { expect, test, vi } from 'vitest';
import { coalesceByKey } from './coalesce';

test('a burst of calls for one key collapses into a single trailing call', () => {
  vi.useFakeTimers();
  const calls: string[] = [];
  const run = coalesceByKey((key) => calls.push(key), 300);

  for (let i = 0; i < 330; i++) run('ds');
  expect(calls).toEqual([]);

  vi.advanceTimersByTime(300);
  expect(calls).toEqual(['ds']);

  vi.useRealTimers();
});

test('different keys settle independently', () => {
  vi.useFakeTimers();
  const calls: string[] = [];
  const run = coalesceByKey((key) => calls.push(key), 300);

  run('alpha');
  run('beta');
  run('alpha');

  vi.advanceTimersByTime(300);
  expect(calls.sort()).toEqual(['alpha', 'beta']);

  vi.useRealTimers();
});

test('a later burst schedules another call', () => {
  vi.useFakeTimers();
  const calls: string[] = [];
  const run = coalesceByKey((key) => calls.push(key), 300);

  run('ds');
  vi.advanceTimersByTime(300);
  run('ds');
  vi.advanceTimersByTime(300);

  expect(calls).toEqual(['ds', 'ds']);

  vi.useRealTimers();
});
