import type { AppearanceSettings, AppearanceUpdateRequest, ThemeChoice } from '$lib/api/types';

export const THEME_STORAGE_KEY = 'webui.theme';
export const ANIMATIONS_STORAGE_KEY = 'webui.animations';

// 'system' matches the server's DEFAULT_APPEARANCE. A divergence here would
// mean a first visit on a light-OS machine paints dark and then flips to
// light when the appearance query resolves -- precisely the flash the
// pre-paint script in app.html exists to prevent.
function readTheme(): ThemeChoice {
  if (typeof localStorage === 'undefined') return 'system';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

function readAnimations(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(ANIMATIONS_STORAGE_KEY) !== 'false';
}

function systemPrefersDark(): boolean {
  if (typeof matchMedia !== 'function') return true;
  return matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return;
  const effective = resolve(choice);
  document.documentElement.classList.toggle('dark', effective === 'dark');
  document.documentElement.style.colorScheme = effective;
}

function applyAnimations(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  // Absence means on, so the attribute is removed rather than set to "on".
  // This mirrors the app.html script, which only ever sets the off case.
  if (enabled) {
    document.documentElement.removeAttribute('data-motion');
  } else {
    document.documentElement.setAttribute('data-motion', 'off');
  }
}

let theme = $state<ThemeChoice>(readTheme());
let animations = $state<boolean>(readAnimations());

applyTheme(theme);
applyAnimations(animations);

// A 'system' choice must track the OS as it changes, not only at load.
if (typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') applyTheme(theme);
  });
}

/**
 * Theme and animation preferences.
 *
 * webui.json is the source of truth; localStorage is a cache that exists so
 * app.html can paint the right frame before any of this runs. Every setter
 * applies to the DOM and the cache immediately and *then* notifies onChange,
 * so the UI never waits on the network to reflect the user's own click.
 *
 * The store performs no I/O itself. LayoutContent assigns onChange to fire the
 * mutation, which keeps this testable without a query client.
 */
export const appearance = {
  get theme(): ThemeChoice {
    return theme;
  },
  get resolvedTheme(): 'light' | 'dark' {
    return resolve(theme);
  },
  get animations(): boolean {
    return animations;
  },

  onChange: null as ((update: AppearanceUpdateRequest) => void) | null,

  setTheme(next: ThemeChoice): void {
    theme = next;
    applyTheme(next);
    if (typeof localStorage !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, next);
    this.onChange?.({ theme: next });
  },

  setAnimations(next: boolean): void {
    animations = next;
    applyAnimations(next);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ANIMATIONS_STORAGE_KEY, String(next));
    }
    this.onChange?.({ animations: next });
  },

  /** Toggle used by the header button. Writes an explicit light or dark based
   *  on what is currently displayed, so clicking it while on 'system' leaves
   *  system mode -- which is what a user expects from a two-state control. */
  toggleTheme(): void {
    this.setTheme(resolve(theme) === 'dark' ? 'light' : 'dark');
  },

  /** Reconcile from the server. Deliberately does not fire onChange: this is
   *  the server telling us, so echoing it back would be a write loop. */
  acceptRemote(settings: AppearanceSettings): void {
    theme = settings.theme;
    animations = settings.animations;
    applyTheme(theme);
    applyAnimations(animations);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(ANIMATIONS_STORAGE_KEY, String(animations));
    }
  },
};
