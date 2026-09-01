/**
 * JavaScript mirror of the `--motion-*` tokens in app.css.
 *
 * Svelte's transition system takes numbers, not CSS custom properties, so the
 * scale has to exist twice. `motion.test.ts` parses app.css and fails if the
 * two ever disagree — do not change one without the other.
 */
export const MOTION = {
  enterMs: 200,
  exitMs: 150,
  layoutMs: 300,
  travelPx: 8,
} as const;

/**
 * Whether motion should run right now.
 *
 * Mirrors the CSS kill switches, and composes them the same one-way manner:
 * the OS preference vetoes unconditionally, and the app setting can never
 * turn motion back on against it.
 */
export function motionEnabled(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.dataset.motion === 'off') return false;
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false;
  }
  return true;
}
