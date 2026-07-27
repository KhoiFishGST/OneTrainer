import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { uiPreferences } from './ui-preferences';

describe('uiPreferences store', () => {
  beforeEach(() => {
    localStorage.clear();
    uiPreferences.reset();
  });

  it('defaults gallerySortOrder to asc', () => {
    const state = get(uiPreferences);
    expect(state.gallerySortOrder).toBe('asc');
  });

  it('updates gallerySortOrder and persists to localStorage', () => {
    uiPreferences.setGallerySortOrder('desc');
    expect(get(uiPreferences).gallerySortOrder).toBe('desc');

    const raw = localStorage.getItem('onetrainer_ui_preferences');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).gallerySortOrder).toBe('desc');
  });

  it('resets state to defaults', () => {
    uiPreferences.setGallerySortOrder('desc');
    expect(get(uiPreferences).gallerySortOrder).toBe('desc');

    uiPreferences.reset();
    expect(get(uiPreferences).gallerySortOrder).toBe('asc');
  });
});
