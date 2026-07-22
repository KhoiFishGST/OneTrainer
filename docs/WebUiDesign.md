# OneTrainer Web UI — Design Specification

Status: **Phase A Implemented** — see [Approved Phase A Specification](#9-delivery-phases) for implementation details.

This document specifies a browser-based frontend for OneTrainer. It is intended
to become the third UI implementation alongside the existing CustomTkinter and
PySide6 frontends, and to eventually be contributed upstream.

---

## 1. Goals and non-goals

### Goals

1. **Full config parity with the native UI** — every tab, field, tooltip, and
   conditional-visibility rule of the native train UI, expressed with web
   design idioms.
2. **Remote-able** — the trainer runs on a headless GPU box; the UI is usable
   from any browser on the network (opt-in), including phones/tablets for
   monitoring.
3. **Live mode** — real-time loss/LR/step-time charts and an in-training
   sample-image gallery, without opening TensorBoard.
4. **Console viewer** — the complete stdout/stderr stream of the training
   process, rendered in the browser like a terminal (including tqdm progress
   bars), because OneTrainer is at heart a console app.
5. **Upstreamable** — zero changes to trainer core, web dependencies fully
   isolated, launched by its own script, off by default.

### Non-goals (for the initial contribution)

- Multi-user support, authentication, or job queueing. Exactly one training
  process, one canonical config, N read/write browser sessions — same trust
  model as the native UI and TensorBoard's `--bind_all`.
- Porting the dataset/captioning tool, video tool, model-conversion tool, and
  sampling tool. The Tools tab links out or shows "use the native tool" until
  a later phase.
- Replacing TensorBoard. It remains available; live mode covers the everyday
  monitoring cases.
- Windows-native process management edge cases beyond what the native UI
  already handles.

---

## 2. Architecture overview

```
┌───────────────────────── Browser ─────────────────────────┐
│  SvelteKit SPA (built with bun, served as static files)   │
│  • TanStack Query: config, presets, metadata, filesystem  │
│  • WebSocket client: progress, metrics, samples, console  │
└─────────────┬─────────────────────────────────────────────┘
              │ REST (JSON)            WebSocket (JSON events)
┌─────────────▼─────────────────────────────────────────────┐
│  FastAPI server — scripts/train_ui_web.py + modules/webui │
│  • Owns the canonical TrainConfig (same load/save flow    │
│    as TopBarController: training_presets/#.json +         │
│    secrets.json)                                          │
│  • Registers TrainCallbacks → broadcasts to WebSocket     │
│  • fd-level console tee → ring buffer + broadcast         │
│  • Serves web/build as static SPA                         │
└─────────────┬─────────────────────────────────────────────┘
              │ in-process (thread), via create.create_trainer
       GenericTrainer / CloudTrainer / MultiTrainer (unchanged)
```

Key properties:

- The server is the **single source of truth** for config state, exactly as
  `TrainUIController` + `UIState` are today. Browsers are views.
- Training runs in a background thread inside the server process, mirroring
  how `TrainUIController.start_training` works, so `TrainCommands` /
  `TrainCallbacks` work unmodified.
- Everything real-time flows over **one** WebSocket endpoint with typed
  messages; everything request/response is REST.

### 2.1 Relationship to the existing MVC split

The fork already separates controllers (`TrainUIController`,
`ModelTabController`, …) from `Base*View` interfaces with Ctk/PySide6
implementations. The web backend is *not* a new `Base*View` implementation —
a browser can't satisfy the synchronous view contract
(`wait_window`, `schedule_on_main_thread`, …). Instead, `modules/webui`
plays the role that view + UIState play together: it owns a `TrainConfig`,
reuses controller logic where it is UI-agnostic (preset tree, save/load,
model-type → training-method mapping), and re-implements the thin remainder.
Where controller methods are currently entangled with view callbacks, we
prefer extracting the UI-agnostic part into the controller (small, reviewable
refactors) over duplicating logic in the web layer.

---

## 3. Backend specification (`modules/webui/`)

### 3.1 Module layout

```
modules/webui/
    __init__.py
    app.py          # FastAPI app factory; wires routers, static files, lifespan
    state.py        # AppState: TrainConfig, trainer thread, callbacks, locks
    console.py      # fd-level stdout/stderr tee, ring buffer
    events.py       # WebSocket hub: connect/disconnect, broadcast, backfill
    schema.py       # config metadata: enums, labels, tooltips, visibility rules
    routers/
        config.py   # config + presets + secrets endpoints
        training.py # start/stop/sample/backup/save + status
        files.py    # filesystem browse + workspace file serving
        meta.py     # model types, training methods, enum values, app info
scripts/train_ui_web.py   # entry point (argparse: --host, --port, --dev)
start-web-ui.sh / .bat    # launcher matching existing launch-script conventions
```

### 3.2 REST API

All endpoints are under `/api`. JSON in/out. Errors use FastAPI's standard
`{"detail": ...}` shape with appropriate status codes.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/config` | Full config as `to_settings_dict(secrets=False)` |
| PUT | `/api/config` | Replace config (`from_dict` + migration), persist to `training_presets/#.json` (same as native "save default") |
| GET | `/api/config/schema` | Field metadata for the current model type + training method (see §5) |
| GET | `/api/presets` | Preset tree (reuses `TopBarController.load_preset_tree`) |
| POST | `/api/presets/load` | body `{path}`; loads preset into canonical config, returns new config |
| POST | `/api/presets/save` | body `{name}`; saves user preset |
| GET | `/api/concepts` | Concepts from `concept_file_name` (list) |
| PUT | `/api/concepts` | Replace concepts list |
| GET | `/api/samples` | Sample definitions from `sample_definition_file_name` |
| PUT | `/api/samples` | Replace sample definitions |
| GET | `/api/meta` | Model types, training methods per model type, enum values, versions |
| GET | `/api/training/status` | `{state: idle|starting|training|stopping, progress, eta, status_text}` |
| POST | `/api/training/start` | Validates, spawns training thread; 409 if already running |
| POST | `/api/training/stop` | `TrainCommands.stop()` |
| POST | `/api/training/sample` | `TrainCommands.sample_default()` ("sample now") |
| POST | `/api/training/backup` | `TrainCommands.backup()` |
| POST | `/api/training/save` | `TrainCommands.save()` |
| GET | `/api/fs/list?path=` | Server-side directory listing for path pickers (dirs + files, filtered by extension) |
| GET | `/api/workspace/files/{path}` | Serves files under `workspace_dir` (sample images, backups); path-traversal-safe |
| GET | `/api/events/backlog` | Ring-buffer backfill: recent console lines, metrics, samples (for page load/reconnect) |
| WS | `/api/events` | Live event stream (see §3.3) |

Notes:

- **Whole-document PUT for config.** The client debounces edits (~500 ms) and
  PUTs the full settings dict. This deliberately reuses the proven
  `from_dict` migration/validation path instead of inventing a dotted-path
  patch protocol. Config docs are ~40 KB; on localhost/LAN this is
  negligible. Revisit only if it measurably isn't.
- **Concurrent writers**: last-write-wins, and every accepted PUT broadcasts
  a `config_changed` event so other open tabs refetch. No optimistic-lock
  machinery in v1 (single-user assumption).
- **Secrets never leave the server.** `GET /api/config` strips secrets.
  A dedicated minimal endpoint for cloud-secret entry can come with the
  Cloud tab phase; until then secrets.json is edited as today.

### 3.3 WebSocket event protocol

Single endpoint `/api/events`. Server→client messages are JSON:
`{"type": <string>, "t": <unix_ms>, ...payload}`. Client→server messages are
not used in v1 (commands go through REST, which keeps auth/audit trivial
later).

| type | payload | source |
|---|---|---|
| `status` | `{text}` | `TrainCallbacks.on_update_status` |
| `progress` | `{epoch_step, max_step, epoch, max_epoch, eta}` | `on_update_train_progress` (throttled to ≤4 Hz) |
| `metric` | `{name, value, step}` — e.g. `loss/train`, `lr/te`, `smooth_loss` | SummaryWriter wrapper (see §6.1) |
| `sample` | `{url, prompt, step, sample_index}` | `on_sample_default` |
| `sample_progress` | `{step, max_step}` | `on_update_sample_default_progress` |
| `console` | `{lines: [{id, text, overwrite}]}` — batched; `overwrite` marks a `\r` redraw of the previous line | console tee (§6.2) |
| `training_state` | `{state}` — `idle/starting/training/stopping/error` | trainer thread lifecycle |
| `config_changed` | `{}` — other clients should refetch `/api/config` | config PUT / preset load |

Delivery rules:

- Events are **fire-and-forget** to connected sockets; slow consumers get
  their send queue trimmed (drop-oldest) rather than back-pressuring the
  trainer. Callbacks execute on the training thread and must never block:
  each callback does a lock-free append to a queue drained by the asyncio
  loop.
- **Backfill over REST, not WS**: on connect the client calls
  `/api/events/backlog` (console ring buffer, metric history, sample list,
  current status) and then applies live events on top. This keeps the WS
  handler stateless and reconnects cheap.

### 3.4 Server lifecycle

- `scripts/train_ui_web.py` parses `--host` (default `127.0.0.1`), `--port`
  (default `7860`… **open question, see §10**), `--dev` (enables CORS for the
  Vite dev server origin).
- Startup: install console tee (only here — never on import, see §6.2), load
  config exactly like the native UI (`training_presets/#.json` +
  `secrets.json`, falling back to `TrainConfig.default_values()`), mount
  routers, mount `web/build` if present else return a "frontend not built"
  page with instructions.
- Shutdown: if training is running, refuse to exit without `--force`
  semantics — Ctrl-C prompts on the console; the browser Stop button uses
  `TrainCommands`.

---

## 4. Frontend specification (`web/`)

### 4.1 Stack and structure

- **SvelteKit** (Svelte 5) in **SPA mode**: `adapter-static` with an
  `index.html` fallback, `ssr = false`. The backend serves the build; there
  is no Node/Bun server at runtime.
- **bun** as package manager and script runner (dev-time only; end users
  never need it if the build is shipped/CI-built).
- **TanStack Query** for all REST state (config, schema, presets, meta, fs
  listings): caching, refetch-on-`config_changed`, mutation state for Save
  buttons.
- **Plain CSS with custom properties** (dark theme first, light theme via
  `prefers-color-scheme`). No Tailwind/component framework in v1 — fewer
  moving parts to review upstream, and the form-heavy UI is served well by a
  small set of hand-rolled controls. Revisit if the team disagrees (§10).
- **lucide** icons (tree-shaken, MIT).
- Charts: **uPlot** (tiny, canvas-based, built for streaming time series —
  appropriate for 10k+ loss points where SVG chart libs struggle).
- Dev loop: `bun run dev` → Vite dev server on :5173 proxying `/api` to the
  Python server started with `--dev`.

```
web/
    package.json  svelte.config.js  vite.config.ts  tsconfig.json
    src/
        app.html  app.css
        lib/
            api/          # typed fetch wrappers + TanStack Query hooks
            ws.ts         # reconnecting WebSocket → Svelte stores
            stores/       # console buffer, metrics buffers, training status
            components/
                rail/         # icon rail + expand behavior
                form/         # Field, Toggle, TextEntry, NumberEntry, Select,
                              # PathEntry (uses /api/fs), TimeEntry (value+unit)
                console/      # virtualized terminal view, ANSI parsing
                charts/       # uPlot wrappers
                StatusBar.svelte
        routes/
            +layout.svelte    # rail | content | persistent status bar + console drawer
            general/  model/  data/  concepts/  training/  sampling/
            backup/  lora/  embedding/  cloud/  tools/  live/  console/
```

### 4.2 State model

Three kinds of client state, deliberately kept separate:

1. **Server documents** (config, concepts, samples, presets, schema, meta) —
   TanStack Query. Edits go into a local working copy (Svelte store seeded
   from the query), debounced PUT, invalidated by `config_changed`.
2. **Streams** (console, metrics, samples, progress) — plain Svelte stores
   fed by `ws.ts`, seeded from `/api/events/backlog`. Not routed through
   TanStack Query: these are append-only streams, not cacheable documents.
3. **UI preferences** (rail expanded, console drawer height, chart smoothing,
   theme) — `localStorage`.

### 4.3 Navigation and layout

- **Left icon rail**, collapsed by default (icons + tooltips), expandable to
  icon + label. Order: Model, Concepts, Training, Sampling, Backup,
  **Live**, then a divider, then General, Data, Cloud, Tools, Console.
  Method-dependent tabs (LoRA / Embedding / Additional Embeddings) appear and
  disappear exactly as in the native UI.
- **Persistent header**: model type selector, training method selector,
  preset picker (tree dropdown mirroring `load_preset_tree`, `#`-prefixed =
  built-in), save-preset button — the native top bar, always visible.
- **Persistent bottom status bar**: status text, step/epoch dual progress,
  ETA, Start/Stop training, "sample now" / "backup now" / "save now",
  Tensorboard link. Visible on every tab.
- **Console drawer**: collapsible panel docked above the status bar,
  available from any tab; the Console rail item opens the same stream
  full-page.
- Each rail item is a SvelteKit route → deep-linkable
  (`http://gpu-box:7860/training`), browser back/forward works.

### 4.4 Form controls

One `Field` wrapper provides label + tooltip (ported from the native
tooltips verbatim) + validation display; controls mirror the native
component set: `switch` → Toggle, `entry` → Text/NumberEntry,
`options`/`options_kv` → Select, `path_entry` → PathEntry (text input +
browse button opening a server-side file browser modal via `/api/fs/list`),
`time_entry` → TimeEntry (number + TimeUnit select). This keeps porting each
`build_*_tab_content` mechanical: every native `components.X(...)` call has
exactly one web equivalent.

---

## 5. Config schema and conditional visibility

The native views encode per-model-type/per-method field visibility
imperatively. The web UI needs it declaratively.

`GET /api/config/schema?model_type=&training_method=` returns, per tab, an
ordered list of field groups:

```json
{
  "tabs": [{
    "id": "training",
    "groups": [{
      "title": "Optimizer",
      "fields": [{
        "key": "optimizer.optimizer",
        "label": "Optimizer",
        "tooltip": "...",
        "control": "select",          // toggle | text | number | select | path | time
        "options": [...],             // for selects: [{label, value}]
        "nullable": true,
        "visible": true,              // resolved for the requested type+method
        "path_mode": "dir"            // for path controls
      }]
    }]
  }]
}
```

Implementation approach:

- Types, nullability, and defaults come **free** from
  `TrainConfig.default_values()` / `BaseConfig` and the enum classes —
  generated, never hand-written.
- Labels, tooltips, grouping, ordering, and visibility predicates live in
  `modules/webui/schema.py` as data (one Python module, mirroring the
  `build_*_tab_content` methods). This is hand-maintained but co-located and
  diff-reviewable; visibility predicates are small lambdas over
  `(model_type, training_method)`.
- The frontend renders forms **generically from the schema** for the
  standard tabs. Bespoke UIs (concepts grid, sample list, live mode,
  console) are hand-built routes.

Drift risk is the main long-term cost of any second frontend. Mitigation: a
unit test asserts every `TrainConfig` key is either present in the schema or
in an explicit `INTENTIONALLY_UNEXPOSED` list, so adding a trainer option
without touching the web schema fails CI loudly instead of silently missing
from the web UI.

---

## 6. Live mode and console — the differentiators

### 6.1 Metrics

The trainer already writes scalars to TensorBoard. Rather than parsing event
files, the web state installs a thin `SummaryWriter` wrapper (decorator
object around the instance the trainer creates) that forwards
`add_scalar(name, value, step)` calls to the event hub in addition to the
normal TB write. Trainer code unchanged.

- Server keeps per-metric ring buffers (last ~20k points, downsampled for
  backlog delivery) so refresh/reconnect restores full charts.
- Live tab charts: smoothed + raw loss, learning rate(s), step time /
  iterations-per-second (derived from `progress` event timing). EMA
  smoothing slider client-side.
- GPU stats: a 2 s server-side poll of
  `torch.cuda.memory_allocated/reserved` per device while training, emitted
  as `metric` events (`vram/allocated:0`, …).

### 6.2 Sample gallery

`on_sample_default` provides `ModelSamplerOutput`; images are already
written under `workspace_dir/samples/...`. The server emits a `sample` event
with a `/api/workspace/files/...` URL. The Live tab shows a gallery grouped
by prompt with a **step scrubber** (drag to watch a prompt evolve over
training). Backlog scans the samples directory on startup so historic
samples from the current workspace appear even after a server restart.

### 6.3 Console viewer

Findings that drive the design: OneTrainer output is raw `print()` +
`tqdm` on stdout/stderr (no `logging`); multi-GPU and dataloader workers are
child processes that inherit the real fds; C extensions write directly to
fd 1/2; cloud training already tails the remote log and re-prints it locally
(`LinuxCloud`), so local capture covers remote runs too.

Therefore capture is at the **file-descriptor level**, in
`train_ui_web.py` only (never on import of `modules.webui`, so no other
entry point can be affected):

1. `os.pipe()`; `dup2` the write end over fd 1 and fd 2 (merged stream —
   what a terminal shows); keep `dup`s of the originals.
2. A reader thread tees raw bytes to the original console fd, appends to the
   ring buffer (last 10k logical lines), and pushes batched `console` events
   (≤30 Hz flush) to the hub.
3. `\r` handling: a chunk containing `\r` without `\n` becomes an
   `overwrite: true` line-update — the client replaces its last line, so
   tqdm bars animate in place instead of flooding the view. `\n` commits the
   line to history. ANSI escapes are preserved and rendered client-side
   (bounded subset: SGR colors; everything else stripped).
4. The merged stream is also tee'd to `workspace_dir/webui.log` (rotating,
   2×10 MB) — feeds the existing debug-package story.

Client: virtualized list (only visible rows in the DOM), autoscroll with
pause-on-scroll-up + "jump to latest" pill, substring filter, download
button (serves `webui.log`).

---

## 7. Training lifecycle

`POST /api/training/start`:

1. Reject (409) if a trainer thread is alive.
2. Run the same validation the native UI runs (`flush_and_validate_all`
   equivalent on the server-side config); return 422 with the error list —
   the client shows them on the relevant fields/tabs.
3. Persist config (`#.json`, secrets) — same behavior as native start.
4. Build `TrainCallbacks` wired to the event hub, `TrainCommands`, create
   the trainer via `modules.util.create` (Generic/Cloud/Multi chosen by
   config, as `TrainUIController` does), and run it on a daemon thread.
5. Emit `training_state` transitions; on exception, `state: error` with the
   traceback going to the console stream (it already does, via the tee).

Stop/sample/backup/save simply proxy `TrainCommands`. Cloud reattach: the
native UI prompts via dialog; the web start endpoint takes an optional
`{"cloud_reattach": true}` and the client shows the same choice when the
server reports a detached run (Phase C, with the Cloud tab).

---

## 8. Security posture

- Bind `127.0.0.1` by default; `--host 0.0.0.0` is an explicit opt-in flag,
  mirroring the existing `tensorboard_expose` convention. The launcher
  prints a warning when exposed.
- No auth in v1 (matches TensorBoard and the project's trust model); the
  API is same-origin only (no CORS except `--dev`).
- `/api/fs/list` is read-only listing; `/api/workspace/files` resolves paths
  strictly under `workspace_dir` (reject `..`/symlink escapes). The server
  intentionally has no generic file-read/write endpoint.
- Secrets are write-only from the client's perspective and never serialized
  into responses.

---

## 9. Delivery phases

Each phase is independently demoable and mergeable in the fork.

- **Phase A — skeleton + pipeline proof (COMPLETE).** FastAPI server backend
  (`modules/webui`), SvelteKit SPA frontend (`web/`), isolated settings and presets
  persistence, real-time console tee and WebSocket event hub, directory browser,
  General/Data/Backup configuration tabs, launch scripts (`start-web-ui.sh`,
  `start-web-ui.bat`), and Playwright E2E browser test coverage.
- **Phase B — full config surface.** Complete `schema.py` for all tabs
  (Model, Training incl. optimizer/scheduler sub-dialogs as modals,
  Sampling, LoRA/Embedding, Concepts with image previews), PathEntry file
  browser, validation display, schema-coverage CI test.
- **Phase C — training + live mode.** Start/stop lifecycle, progress/status
  wiring, metrics via SummaryWriter wrapper, uPlot charts, sample gallery
  with scrubber, GPU stats, Cloud tab + reattach flow.
- **Phase D — polish + upstream prep.** Tools tab decisions, light theme,
  mobile monitoring layout for Live/Console, README + docs, demo GIFs,
  upstream discussion issue + PR.

---

## 10. Open questions (input wanted)

1. **Port default** — 7860 is the de-facto SD-tooling port (Gradio) but
   collides with A1111/Forge on shared boxes. Alternative: something
   unclaimed like 7801. *Leaning: 7801.*
2. **Ship built frontend or build on install?** Committing `web/build`
   keeps `bun` out of user installs but bloats diffs; building in CI +
   release artifacts is cleaner but changes the project's install story.
   *Leaning: gitignore the build, have `start-web-ui.sh` build with bun if
   missing, and raise CI artifacts during upstream discussion.*
3. **Styling** — plain CSS (spec'd above) vs Tailwind. Tailwind speeds up
   development but adds a build-time dependency surface reviewers must
   swallow. *Leaning: plain CSS.*
4. **Optimizer/scheduler param dialogs** — modal (native parity) vs inline
   expandable sections (more web-native). *Leaning: modal for parity, easy
   to revisit.*
5. **Config edit granularity** — whole-doc PUT (spec'd) is simplest; if we
   later want per-field server round-trips (e.g. live validation), add
   `PATCH /api/config` with a JSON-merge-patch body rather than dotted
   paths.

---

## 11. Dependency policy

- Python: `fastapi`, `uvicorn[standard]` only, listed as an optional extra
  (`requirements-webui.txt` or extras group) so existing installs are
  untouched.
- JS: svelte/kit/vite toolchain, `@tanstack/svelte-query`, `lucide-svelte`,
  `uplot`. Dev-only unless Q10.2 resolves to committing builds.
- No changes to `modules/trainer`, `modules/modelSetup`, or any training
  code path. The only shared-code changes permitted are extractions of
  UI-agnostic logic from `modules/ui` controllers, each as its own commit.
