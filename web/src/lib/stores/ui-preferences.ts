import { writable } from 'svelte/store';

export interface UiPreferences {
  gallerySortOrder: 'asc' | 'desc';
}

const STORAGE_KEY = 'onetrainer_ui_preferences';

const DEFAULT_PREFERENCES: UiPreferences = {
  gallerySortOrder: 'asc',
};

function loadPreferences(): UiPreferences {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_PREFERENCES };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences(prefs: UiPreferences) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota/storage errors
  }
}

function createUiPreferencesStore() {
  const { subscribe, set, update } = writable<UiPreferences>(loadPreferences());

  return {
    subscribe,
    setGallerySortOrder: (order: 'asc' | 'desc') => {
      update((prefs) => {
        const updated = { ...prefs, gallerySortOrder: order };
        savePreferences(updated);
        return updated;
      });
    },
    reset: () => {
      set({ ...DEFAULT_PREFERENCES });
      savePreferences(DEFAULT_PREFERENCES);
    },
  };
}

export const uiPreferences = createUiPreferencesStore();
