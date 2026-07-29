import { describe, expect, it } from 'vitest';
import { SIDEBAR_WIDTH_MOBILE } from './constants';

describe('Sidebar Constants', () => {
  it('sets mobile sidebar width to 9rem for a compact mobile sheet', () => {
    expect(SIDEBAR_WIDTH_MOBILE).toBe('9rem');
  });
});
