# Web UI Motion System and Web UI Settings Tab

Date: 2026-08-01
Status: Approved design, ready for implementation planning

## Problem

The web UI has almost no motion. Modals, dropdowns, tooltips and popovers appear
and vanish between frames. The console drawer is gated by `{#if open}` and pops
in at whatever height it last remembered. Route changes swap instantly.

This is not because nobody wrote the animations. The vendored shadcn components
already carry `data-[state=open]:animate-in`, `fade-in-0`, `zoom-in-95` and
`duration-100` classes. Those utilities require the `tw-animate-css` plugin,
which the project does not install — `app.css` imports plain `@import
"tailwindcss"`. Every one of those class names compiles to nothing. A previous
change hit this and hand-wrote the sheet's slide keyframes in `app.css` rather
than add the plugin, deliberately, to avoid switching on nine vendored overlay
components at once.

The goal now is the opposite: switch all of them on, at a deliberately small
scale, and give users one place to turn motion off.

## Goals

- Motion on every overlay, the console drawer, route changes, and in-page state
  changes, tuned to be felt rather than watched.
- One definition of the motion scale, so the whole feel is retunable in a few
  lines.
- A user-facing setting to disable animations, persisted server-side so it
  follows the user across browsers.
- A theme control in the same place, also server-persisted, with a `system`
  option, without regressing the existing no-flash-on-load behavior.

## Non-goals

- No new runtime dependency. Specifically not `tw-animate-css`.
- No edits to vendored `src/lib/components/ui/**` components.
- No motion on progress indicators.
- No changes to `TrainConfig` or the training config schema.

## Motion scale: Crisp

Chosen from a live three-way comparison (Crisp / Standard / Soft) rendered in
the app's own dark tokens.

| Property | Value |
| --- | --- |
| Enter duration | 90ms |
| Exit duration | 70ms |
| Enter easing | `cubic-bezier(0, 0, 0.2, 1)` (decelerate) |
| Exit easing | `cubic-bezier(0.4, 0, 1, 1)` (accelerate) |
| Travel | 2px |
| Scale | 0.99 |
| Layout-move duration | 120ms |

Two properties of this scale are load-bearing and must not be "cleaned up"
during implementation:

- **Exits are faster than entrances.** An entrance is information — it shows you
  where a thing came from. An exit is an obstacle. They are not symmetric.
- **Travel is coupled to duration.** 2px over 280ms looks broken; 14px over 90ms
  looks like a jump cut. Changing one without the other degrades the result.

`--motion-duration-layout` (120ms) exists for a single reason: the rail moves
112px (48px → 160px) and the console drawer moves its full height, while
overlays move 2px. Forcing 112px into 90ms reads as a snap. It is still well
below the threshold where a user perceives waiting.

## Architecture

### 1. Motion tokens (`web/src/app.css`)

A token block next to the existing color tokens:

```css
:root {
  --motion-duration-enter: 90ms;
  --motion-duration-exit: 70ms;
  --motion-duration-layout: 120ms;
  --motion-ease-enter: cubic-bezier(0, 0, 0.2, 1);
  --motion-ease-exit: cubic-bezier(0.4, 0, 1, 1);
  --motion-travel: 2px;
  --motion-scale: 0.99;
}
```

Every animation and transition in the application references these tokens and no
other literal timing values. This is the single point of retuning.

### 2. Two kill switches, composed one-way

```css
html[data-motion='off'] {
  --motion-duration-enter: 0.01ms;
  --motion-duration-exit: 0.01ms;
  --motion-duration-layout: 0.01ms;
  --motion-travel: 0px;
  --motion-scale: 1;
}

@media (prefers-reduced-motion: reduce) {
  :root { /* the same overrides */ }
}
```

**Motion runs only when the app setting is on AND the OS is not requesting
reduced motion.** The OS preference always vetoes. The app setting can never
turn motion back on against the OS. This is one-way by design and must not be
"fixed" into a symmetric override.

**Zeroing durations, never `animation: none`.** bits-ui keeps a closing overlay
mounted until its animation ends. Removing the animation risks stranding a
closed dialog in the DOM; a 0.01ms animation still fires `animationend`, so
unmount always completes. This also matches the 0.01ms convention already used
by the existing `prefers-reduced-motion` block in `app.css`.

`data-motion` is set on `document.documentElement`, the same element and the
same lifecycle as the existing `.dark` class.

### 3. Overlay coverage by attribute selector

bits-ui sets `data-state="open" | "closed"` on every overlay it portals. A block
of rules in `app.css` keyed on that attribute covers dialogs, alert dialogs,
dropdown menus, selects, popovers, tooltips and sheets at once:

- **Scrims** (dialog / alert-dialog / drawer overlays): opacity only.
- **Content** (dialog, alert-dialog, dropdown, select, popover, tooltip):
  opacity + `translateY(var(--motion-travel))` + `scale(var(--motion-scale))`.
- **Sheets**: the existing hand-written slide keyframes, retargeted from their
  hardcoded `200ms ease-in-out` onto the tokens.

The inert `animate-in` / `zoom-in-95` classes in the vendored components are
left untouched and remain inert. Because `app.css` rules are unlayered and
Tailwind utilities are layered, these rules win regardless — so the app stays
correct even if someone later adds `tw-animate-css`. This is the same
specificity property `app.css` already documents for the phone `min-height`
rule.

Rejected alternatives:

- **Install `tw-animate-css` and retune the components.** The durations and
  travel distances are hardcoded in each component's class string
  (`duration-100`, `zoom-in-95` = 5% scale, `slide-in-from-top-2` = 8px). Crisp
  needs 90ms / 1% / 2px, so all nine vendored files would need editing — a
  permanent divergence from upstream shadcn, with the timing scattered across
  nine class strings instead of one token block.
- **Per-component Svelte `transition:` directives.** They cannot reach inside
  bits-ui's portalled content, and the `:global()` escape hatch they would
  require is banned by `style-boundary.test.ts`.

Evidence the attribute-selector approach works for exit animations — the part
that usually fails silently — is that the sheet's existing
`data-state='closed'` animation runs today, which proves bits-ui holds nodes
mounted through their close animation.

### 4. Route transitions

`RoutePage` is used by 13 of the 14 app routes and is mounted fresh on every
route change. A plain CSS `animation` on it therefore fires on its own: 90ms
fade plus 2px rise.

**Enter-only. There is no exit transition on navigation.** An exit would insert
70ms between the click and the new page, which is precisely the latency the
Crisp scale exists to avoid. The outgoing page is removed immediately.

This requires no `{#key}` block, no forced remount, and no `onNavigate` hook.

Free consequence: the seven schema-form pages render `FormPageSkeleton` outside
`RoutePage` and swap to `RoutePage` once the workspace resolves, so this same
mount animation *is* the skeleton-to-content crossfade. A separate skeleton
transition is therefore out of scope as redundant.

`/console` gets the same animation on its own wrapper. `/login` stays plain.

### 5. Console drawer

The drawer stops unmounting. Once its lazy chunk has loaded, the `<section>`
stays in the DOM and `open` drives `height: 0` ↔ `height: {drawerHeight}px` over
`--motion-duration-layout`.

It remains a flex child, so main content reflows as the drawer opens. This is
correct: the drawer genuinely pushes content rather than covering it, and a
`transform` would leave main content sitting underneath it.

Three details this requires:

- **`inert` while closed.** A zero-height drawer otherwise keeps its close
  button, fullscreen link and resize slider in the tab order.
- **Transition suppressed during drag.** The resize handle writes inline height
  on every `mousemove`; a transition makes the drawer lag the pointer. The
  existing `.resizing` class is the hook.
- **Mobile needs an explicit closed state.** The existing
  `height: 75dvh !important` rule under `@media (max-width: 768px)` overrides
  the inline height, so the closed state cannot be inherited from the desktop
  rule and must be declared for mobile.

### 6. Rail

The vendored sidebar hardcodes `transition-[width] duration-200 ease-linear`.
An unlayered `app.css` rule targeting its `data-slot` retargets duration and
easing onto `--motion-duration-layout` / `--motion-ease-enter`. No vendored file
is edited, and the rail is covered by the kill switch automatically.

### 7. In-page state changes

- **List add/remove** (dataset cards, sample prompt cards, embedding cards):
  Svelte `transition:` + `animate:flip`.
- **Status pills, GPU monitor, training status**: colour transitions only, no
  movement.
- **Toasts**: `svelte-sonner` ships its own transitions independent of Tailwind
  and is expected to animate already. It is left as-is except for one required
  change: an `app.css` rule brings its durations under the token block so the
  kill switch reaches it. Toasts must not keep animating when animations are
  off.

**Explicitly excluded: progress bars and the upload summary bar.** They update
at high frequency; a width transition makes the bar lag the real number and
therefore display a value that is not true.

### 8. Motion constants for JavaScript

Svelte's transition system takes JS numbers, not CSS custom properties. A
`web/src/lib/motion.ts` exports the same durations and travel for the list
transitions above, plus a helper reporting whether motion is currently enabled.

To prevent the two definitions drifting, a vitest parses `app.css`, extracts the
token values, and asserts they match `motion.ts`. This follows the existing
boundary-test style (`style-boundary.test.ts`,
`ui-dependency-boundary.test.ts`).

## Web UI settings

### Storage

Two preferences persist server-side in `webui.json` under a new `appearance`
key, alongside the existing `password` and `datasets_dir`:

```json
{ "appearance": { "theme": "system", "animations": true } }
```

The name `appearance` is used consistently across all three layers — the
`webui.json` key, the `/api/appearance` endpoint, and the
`lib/stores/appearance.svelte.ts` store. It deliberately avoids "ui
preferences": `lib/stores/ui-preferences.ts` already exists as an unrelated
localStorage-only store for gallery sort order, and two similarly named stores
in one directory would be a standing source of confusion.

Defaults: `theme: "system"`, `animations: true`.

`SettingsStore` (`modules/webui/settings_store.py`) gains `get_appearance()` /
`set_appearance()` following
the `get_datasets_dir` / `set_datasets_dir` precedent exactly:

- **Getters fall back to defaults** on a missing, unreadable or malformed file,
  and never raise. A corrupt settings file must not take down the UI.
- **Setters call `_read_for_update()`**, so they raise
  `SettingsStoreUnreadableError` rather than clobber a file they could not
  parse. That file holds the password hash.

### API

New `modules/webui/routers/appearance.py`, mounted at the `/api` prefix like
every other router in `app.py`:

- `GET /api/appearance` → `{ "theme": "light|dark|system", "animations": bool }`
- `PUT /api/appearance` → partial update, returns the full resulting document.

### Frontend store lifecycle

`theme.svelte.ts` becomes `appearance.svelte.ts`, covering both settings.

The server is the source of truth; localStorage is a synchronous cache. This
matters because a purely server-sourced preference resolves only after first
paint, which would reintroduce a flash of the wrong theme.

**The pre-paint hook is the blocking inline script already in `app.html`**, not
module load. `routes/+layout.ts` sets `ssr = false`, so that script is the only
code that runs before first paint. It currently reads `webui.theme` from
localStorage and toggles `.dark`. It is extended to:

- accept `system` as a valid stored value and resolve it through
  `matchMedia('(prefers-color-scheme: dark)')`,
- read the cached animations value and set `data-motion` on
  `document.documentElement`.

It must remain dependency-free, synchronous, and wrapped in try/catch — a
throw there blocks the whole page.

The store then handles the remaining two steps:

1. **When the appearance query resolves**, reconcile: if the server value
   differs from the cache, apply it and rewrite the cache.
2. **On user change**, apply to the DOM and cache immediately, then `PUT`. The
   UI never waits on the network to reflect the user's own click.

`theme: "system"` keeps a live `matchMedia` listener, so it tracks OS changes
rather than only reading at load.

Note that `theme.test.ts` currently asserts `'system'` is an invalid stored
value that falls back to dark. That assertion inverts under this design and
must be updated, not deleted.

### Header toggle

The existing header light/dark button stays. It reads the currently *resolved*
appearance and writes an explicit `light` or `dark` — so clicking it while in
`system` mode leaves system mode, which matches user expectation. It writes
through the same store, so the settings tab reflects it immediately and vice
versa. The two controls can never disagree.

### The Web UI tab

`subnavTabs` in `routes/(app)/general/+page.svelte` gains
`{ id: 'webui', label: 'Web UI' }`. The page branches: `webui` renders a new
`WebUiSettingsPanel`, every other sub-tab renders `SchemaForm` as today.

**This tab has a different contract from the rest of the page, and must say
so.** Every other setting under General is training config with workspace-draft
semantics — edit a draft, it becomes dirty, it saves. These two are client
preferences that apply the instant they are touched, and never enter the
training config. The panel therefore opens with a one-line explanation:

> These settings affect the OneTrainer web interface only. They are not part of
> your training configuration and apply immediately.

The panel reuses `FormPanel`, `Field` and `ValueSelect` so it looks native to
the page. Theme is an enum field rendered like every other enum field; no new
component is introduced.

Controls:

- **Theme** — `ValueSelect` with Light / Dark / System.
- **Animations** — `Switch`, on = enabled. Framed positively rather than as
  "Disable animations": a switch that must be turned ON to make something not
  happen is a reliable source of misreads.

When the OS requests reduced motion, an inline note appears under the switch
stating that animations are off regardless of its position. The switch stays
live and settable. Without the note the setting looks broken.

## Testing

**Python** (`modules/webui/tests/`):

- Getters return defaults for missing, unreadable and malformed files.
- Setters raise `SettingsStoreUnreadableError` on a malformed existing file and
  do not write.
- Round-trip through the `GET` / `PUT` endpoints, including partial update.

**Vitest** (`web/src/`):

- `motion.ts` values match the `app.css` tokens (drift guard).
- Store lifecycle: cache applied synchronously at load; server value reconciled
  on query resolve; user change applies before the network call.
- Header toggle and settings tab stay in agreement, including from `system`.
- `data-motion="off"` is present on `<html>` when animations are disabled.
- `WebUiSettingsPanel` renders both controls and the reduced-motion note when
  `matchMedia` reports `prefers-reduced-motion: reduce`.
- Existing `style-boundary` and `ui-dependency-boundary` tests continue to pass:
  no `:global()` in `.svelte` files, no new package imports under
  `components/ui/`.

**Playwright** (`web/e2e/`):

- The 44px touch-target and axe suites pass on the new tab.
- Console drawer open/close does not leave focusable elements reachable while
  closed.

## Risks

- **E2E flake.** Adding animation to overlays can make assertions race the
  transition. Playwright auto-waits and 90ms is short, but overlay-heavy specs
  should be watched on the first run.
- **The console drawer stops unmounting**, so `ConsoleView` stays mounted while
  closed. Confirm this does not keep it processing console events off-screen; if
  it does, gate the view's work on `open` rather than reverting the animation.
- **The `app.css` comment rejecting `tw-animate-css`** states a rationale that
  this design inverts. It must be rewritten, not left contradicting the code.
