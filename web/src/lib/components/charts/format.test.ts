import { describe, expect, it } from 'vitest';
import { formatMetricValue, humanizeMetricKey } from './format';

describe('formatMetricValue', () => {
  it('does not collapse small learning rates to zero', () => {
    expect(formatMetricValue(1e-4)).toBe('1.00e-4');
    expect(formatMetricValue(3e-6)).toBe('3.00e-6');
    expect(formatMetricValue(0.000123)).toBe('1.23e-4');
  });

  it('keeps exact zero readable', () => {
    expect(formatMetricValue(0)).toBe('0');
  });

  it('returns empty string for missing values', () => {
    expect(formatMetricValue(null)).toBe('');
    expect(formatMetricValue(undefined)).toBe('');
    expect(formatMetricValue(NaN)).toBe('');
  });

  it('formats normal-range values without exponent notation', () => {
    expect(formatMetricValue(0.5)).toBe('0.5');
    expect(formatMetricValue(12.25)).toBe('12.25');
  });

  it('uses exponent notation for very large values', () => {
    expect(formatMetricValue(2.5e7)).toBe('2.50e+7');
  });

  it('handles negatives', () => {
    expect(formatMetricValue(-1e-4)).toBe('-1.00e-4');
  });
});

describe('humanizeMetricKey', () => {
  it('strips the lr prefix', () => {
    expect(humanizeMetricKey('lr_unet')).toBe('unet');
    expect(humanizeMetricKey('lr_text_encoder')).toBe('text encoder');
  });

  it('leaves loss keys readable', () => {
    expect(humanizeMetricKey('loss_train_step')).toBe('loss train step');
    expect(humanizeMetricKey('smooth_loss_train_step')).toBe('smooth loss train step');
  });
});
