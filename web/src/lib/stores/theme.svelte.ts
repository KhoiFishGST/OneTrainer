export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'webui.theme';

function readTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

function applyTheme(val: Theme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', val === 'dark');
  document.documentElement.style.colorScheme = val;
}

let value = $state<Theme>(readTheme());
applyTheme(value);

export const theme = {
  get value(): Theme {
    return value;
  },
  set(next: Theme): void {
    value = next;
    if (typeof window !== 'undefined') localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  },
  toggle(): void {
    this.set(value === 'dark' ? 'light' : 'dark');
  },
};
