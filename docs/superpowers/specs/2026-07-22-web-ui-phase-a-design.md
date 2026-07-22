# OneTrainer Web UI Phase A Design

Status: approved

Date: 2026-07-22

## 1. Purpose

This document defines the first independently deliverable phase of the
browser-based OneTrainer UI described in `docs/WebUiDesign.md`. The roadmap
document remains the product-level direction. This document is the
implementation contract for Phase A only.

Phase A proves four foundations end to end:

1. A FastAPI process can own and persist the canonical OneTrainer config.
2. A SvelteKit SPA can render useful config tabs from a server-provided schema.
3. Browser sessions can edit the same config without silent whole-document
   clobbering.
4. File-descriptor-level console capture can reach a reconnecting browser
   without blocking OneTrainer output.

The result is useful as a remote configuration and console UI, but it cannot
start a training run. Training lifecycle support belongs to Phase C of the
roadmap.

## 2. Scope

### 2.1 Included

- A web entry point and Linux/Windows launchers.
- A FastAPI application served on `127.0.0.1:7801` by default.
- A statically built SvelteKit SPA.
- The final application shell: navigation rail, header, status bar, and console
  drawer.
- Fully editable General, Data, and Backup tabs.
- Full config GET/PUT with debounced autosave and atomic persistence.
- Revision-based conflict detection between browser sessions.
- Model type, training method, enum, and preset metadata.
- Preset listing, loading, and saving.
- A read-only server directory picker for directory-valued fields.
- Complete current-process stdout/stderr capture, terminal tee, browser
  streaming, backlog, filtering, and log download.
- Complete Phase A editing flows on desktop and phone layouts.
- Python unit/API tests, frontend tests, and Playwright browser smoke tests.

### 2.2 Excluded

- Starting, stopping, sampling, backing up, or saving a trainer.
- `GenericTrainer`, `CloudTrainer`, or `MultiTrainer` integration.
- Concepts, samples, model, training, LoRA, embedding, or cloud editors.
- Metrics, charts, GPU polling, sample galleries, and TensorBoard controls.
- Client-side secret viewing or editing.
- File-valued path browsing, extension filters, or file previews.
- A light theme.
- Authentication, user accounts, job queues, and multi-user permissions.

Excluded rail destinations remain visible but disabled. Their tooltips state
that the feature is not available in this version. The disabled training
controls in the status bar use the same treatment.

## 3. Selected Approach

Phase A uses a dedicated web schema and state service.

`ConfigService` owns the canonical config, revision, locking, validation, and
persistence. `SchemaRegistry` combines generated `TrainConfig` metadata with
explicit labels, tooltips, grouping, controls, and visibility rules. The
frontend renders ordinary forms generically. Later bespoke surfaces such as
Concepts and Live may use custom components while retaining the same API and
shell; Console is already a bespoke Phase A surface.

The following alternatives were rejected:

- Recording existing native view builders through fake components would reduce
  initial metadata duplication but would couple the browser contract to
  synchronous widget behavior, dialogs, and controller side effects.
- Hand-building every Svelte form would maximize layout freedom but duplicate
  types and visibility rules and make full parity difficult to maintain.

## 4. User Experience

### 4.1 Visual language

Phase A uses the approved Graphite and Ember visual language:

- Near-black neutral page and panel surfaces.
- Restrained warm orange for active navigation, focus, progress, and primary
  actions.
- Compact controls suitable for a dense technical workbench.
- Semantic CSS custom properties rather than component-local literal colors.
- No gradients, decorative glow, or dashboard-style visual noise.

Only the dark theme ships in Phase A. The semantic tokens must permit a later
light token set without changing component structure.

### 4.2 Desktop shell

The desktop shell has four persistent areas:

1. A quiet left utility rail.
2. A top config header.
3. Routed page content.
4. A bottom status bar with a console drawer immediately above it.

The rail starts in compact icon-only mode at approximately 48 px. The user can
expand and pin it at approximately 176 px to show icons and labels. Expansion
reflows the content instead of covering it. The preference is stored in
`localStorage`.

The header contains model type, training method, preset selection, named-preset
save, and autosave state. It remains visible across routes.

The status bar displays server state and disabled future training actions. The
console drawer is available from every route. The Console rail destination
opens the same stream as a full page.

Forms use two columns where available space permits. Each field has a semantic
label, native tooltip text, validation text, and a control with a stable config
path.

### 4.3 Phone shell

Below the mobile breakpoint, the rail becomes an off-canvas drawer opened from
the header. It opens in the expanded icon-and-label state. The routed content
uses the full phone width while the drawer is closed.

Phone requirements are not monitoring-only. Every Phase A edit and command is
available:

- Forms use one column.
- Interactive targets are at least 44 px high or wide where applicable.
- Header controls wrap into a compact second row instead of scrolling
  horizontally.
- The directory picker becomes a full-screen sheet with breadcrumbs.
- The status bar accounts for safe-area insets.
- Dialog focus is trapped and returns to its trigger when closed.

### 4.4 Accessibility

- All controls have programmatic labels and error descriptions.
- Navigation and dialogs are keyboard operable.
- Focus is always visible.
- State is not conveyed by color alone.
- Disabled placeholders use `aria-disabled` and cannot receive action events.
- Animations honor `prefers-reduced-motion`.
- Console output is text, not injected HTML.

## 5. System Architecture

```text
+--------------------------- Browser ----------------------------+
| SvelteKit static SPA                                          |
| - application shell                                           |
| - schema-rendered General/Data/Backup routes                   |
| - local config workspace                                      |
| - console drawer and route                                    |
| - TanStack Query documents + plain stream stores              |
+--------------------+-------------------+-----------------------+
                     | REST              | WebSocket
+--------------------v-------------------v-----------------------+
| FastAPI application                                           |
| - ConfigService + strict codec                                |
| - SchemaRegistry                                              |
| - PresetService                                               |
| - DirectoryService                                            |
| - ConsoleCapture + EventHub                                   |
+--------------------+-------------------+-----------------------+
                     | existing types    | local files
+--------------------v-------------------v-----------------------+
| TrainConfig, shared config I/O, presets, server filesystem,   |
| static build, and rotating web UI log                          |
+----------------------------------------------------------------+

Future Phase C:
ConfigService validated deep snapshot -> TrainingService -> trainers
```

The editable canonical config is never intended to become a live trainer
config. Phase C must create a validated deep snapshot before trainer creation.
This prevents browser edits from mutating a running trainer.

Trainer, model setup, model, and data-loader modules are unchanged in Phase A.

## 6. Backend Design

### 6.1 Module responsibilities

```text
modules/webui/
    __init__.py
    app.py                 # app factory, lifespan, static SPA
    state.py               # service construction and dependency access
    config_service.py      # canonical config transaction boundary
    config_codec.py        # strict recursive wire validation
    schema.py              # generated and explicit field metadata
    presets.py             # constrained preset operations
    directories.py         # read-only directory listing
    events.py              # event sequencing, backlog, WS clients
    console.py             # fd capture, parser, ring buffer, log sink
    routers/
        config.py
        meta.py
        presets.py
        directories.py
        events.py
        console.py

scripts/train_ui_web.py
start-web-ui.sh
start-web-ui.bat
```

`state.py` composes services and exposes them to FastAPI dependencies. Business
behavior remains in the focused service modules rather than accumulating in a
large application-state class.

### 6.2 Shared config I/O

Pure config and preset I/O currently embedded in `TopBarController` is
extracted into a shared utility module. The native controller calls the shared
functions after the extraction. This gives native and web UIs one
implementation for:

- Loading `training_presets/#.json` with migration.
- Loading `secrets.json` separately.
- Distinguishing built-in presets from user configs.
- Saving settings without secrets through `write_json_atomic`.
- Sanitizing named preset filenames.
- Walking the built-in preset tree.

The extraction must preserve native behavior and is the only planned change to
existing UI support code in Phase A.

### 6.3 Startup state

At application startup, `ConfigService` loads `training_presets/#.json` and
`secrets.json`. If the last-session file is absent, it uses
`TrainConfig.default_values()`. If loading fails, the server logs the error,
uses defaults, and exposes a startup warning through `/api/health` and the
console backlog.

The service owns:

- One canonical `TrainConfig`.
- One opaque revision token.
- One async mutation lock.

The revision token contains a per-process instance identifier and a monotonic
counter. This keeps revisions ordered within a server process while ensuring a
token cannot accidentally match after restart.

### 6.4 Strict config codec

`BaseConfig.from_dict` is intentionally permissive and catches individual
conversion errors. It cannot be the API validation boundary by itself.

Before calling it, `config_codec.py` recursively validates the wire document
against metadata from a fresh default config:

- Object, list, scalar, and enum shapes.
- Known field names.
- Required current-document fields.
- Nullability.
- Boolean, integer, and float distinctions.
- Finite numeric values except where the config explicitly supports infinity.

After structural validation, decoding occurs into a new default config. The
canonical object is never mutated during decoding.

Save-time field validation covers representational correctness and declared
range constraints. It does not require the config to be ready to train. In
particular, Phase A does not reject a structurally valid config because a model
path is missing or a server path does not yet exist. Launch-time validation is
a separate Phase C concern.

### 6.5 Config transaction

`GET /api/config` returns:

```json
{
  "config": {},
  "revision": "<instance-id>:<counter>"
}
```

`PUT /api/config` accepts:

```json
{
  "config": {},
  "base_revision": "<instance-id>:<counter>",
  "overwrite": false
}
```

An accepted PUT executes under the mutation lock:

1. Compare `base_revision` with the current revision.
2. Strictly validate the wire document.
3. Decode into a fresh config.
4. Copy the current server-side secrets into the fresh config.
5. Run save-time field validation.
6. Serialize settings without secrets.
7. Atomically replace `training_presets/#.json`.
8. Swap the canonical object.
9. Increment the revision.

Disk persistence occurs before the in-memory swap. A write failure leaves both
the canonical config and revision unchanged.

A stale revision returns `409 Conflict` and the current revision. Explicit
overwrite sends `overwrite: true` with the current revision observed in that
conflict. The service still requires an exact revision match; another
intervening write produces another conflict instead of being silently erased.

Client-supplied secret fields are rejected. Settings updates and preset loads
always preserve the server's existing secrets.

### 6.6 Schema registry

The schema registry produces only the General, Data, and Backup tab schemas in
Phase A. It combines:

- Generated type, default, enum, and nullability metadata from `TrainConfig`.
- Explicit field labels and native tooltip text.
- Grouping and order.
- Control type.
- Save-time constraints.
- Directory mode.
- Visibility predicates resolved for model type and training method.

The authoritative Phase A field set is every config-bound control emitted by
`BaseTrainUIView.build_general_tab_content`,
`BaseTrainUIView.build_data_tab_content`, and
`BaseTrainUIView.build_backup_tab_content` at the implementation baseline,
including their labels and tooltips. Buttons that invoke excluded trainer or
tool actions are not schema fields.

The response contains resolved visibility rather than executable conditions.
`GET /api/config/schema` requires valid `model_type` and `training_method`
query parameters. Changing either valid draft value invalidates and refetches
the schema immediately; it does not wait for the autosave request.

Tests assert that Phase A schema keys are real config paths, unique, and equal
to the approved field set for the three implemented tabs. Full-config coverage
becomes mandatory when Phase B exposes all standard tabs.

### 6.7 Presets

The preset tree returns opaque IDs constrained beneath the configured preset
directory. Clients never submit arbitrary filesystem paths to preset
endpoints.

Preset load is revision-aware and uses the same atomic config transaction as a
PUT. Built-in presets skip migration as the native UI does; user presets run
migrations. Loading preserves secrets.

Preset save snapshots the current canonical settings and writes a sanitized
name atomically. Saving a named preset does not change the canonical revision.

### 6.8 Directory browser

`DirectoryService` provides read-only traversal of directories on the server
machine. It returns the normalized current path, parent availability, and
sorted child directories. It does not return file contents or provide write,
rename, delete, or upload operations.

Platform roots are explicit: `/` on POSIX and available drive roots on Windows.
Permission failures are reported as `403`; missing paths as `404`. The service
resolves the requested path before listing it. Directory symlinks are allowed
because browsing is intentionally not root-confined, but the response reports
their resolved canonical path. A response contains at most 5,000 child
directories and sets `truncated: true` if more exist.

Directory browsing is intentionally broad because the UI configures paths on
the server machine. The default loopback bind and explicit LAN warning are the
security boundary, matching the native file picker's trust model.

## 7. API Contract

All endpoints use JSON except the WebSocket and log download. Errors use
FastAPI's `detail` field. Field-validation errors use
`detail: [{"path": "...", "message": "..."}]`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Server, frontend build, version, and startup warnings |
| `GET` | `/api/config` | Canonical settings and revision |
| `PUT` | `/api/config` | Revision-aware whole-document update |
| `GET` | `/api/config/schema?model_type=&training_method=` | Resolved General/Data/Backup schema |
| `GET` | `/api/presets` | Constrained preset tree |
| `POST` | `/api/presets/load` | Revision-aware preset load |
| `POST` | `/api/presets/save` | Save current config as a named preset |
| `GET` | `/api/meta` | Model types, methods, enums, and app version |
| `GET` | `/api/fs/directories` | Read-only server directory listing |
| `GET` | `/api/events/backlog` | Console snapshot, stream cursor, config revision |
| `WS` | `/api/events` | Sequenced console and config-change events |
| `GET` | `/api/console/log` | Download the active rotating web UI log |

Preset load accepts `{preset_id, base_revision, overwrite}`. Preset save
accepts `{name}` and snapshots the canonical config. Directory listing accepts
one `path` query parameter. Config and preset-load responses return the same
`{config, revision}` envelope.

Status behavior is consistent:

- `400` for malformed request semantics or invalid path syntax.
- `403` for origin or filesystem permission failures.
- `404` for unknown presets or directories.
- `409` for stale config revisions.
- `413` for oversized request bodies.
- `422` for structurally invalid config documents or field constraints.
- `500` for persistence and unexpected server failures.

JSON request bodies are limited to 1 MiB.

No concepts, samples, workspace-file, or training endpoints exist in Phase A.

## 8. Frontend Design

### 8.1 Structure

```text
web/
    package.json
    bun.lock
    svelte.config.js
    vite.config.ts
    tsconfig.json
    src/
        app.html
        app.css
        lib/
            api/
                client.ts
                types.ts
                queries.ts
            config/
                workspace.svelte.ts
                validation.ts
            events/
                client.ts
                console-store.svelte.ts
            components/
                shell/
                form/
                console/
                directory/
        routes/
            +layout.svelte
            general/
            data/
            backup/
            console/
```

SvelteKit runs in SPA mode through `adapter-static`; runtime Node or Bun is not
required after the build. The root route redirects to General, and the static
fallback preserves direct links to each implemented route.

### 8.2 State boundaries

Frontend state is separated into three categories:

1. TanStack Query owns server documents: config baseline, schema, presets,
   metadata, health, and directory listings.
2. Plain Svelte stores own append-oriented event state: console rows,
   connection status, stream ID, and sequence cursor.
3. `localStorage` owns UI preferences: pinned rail state, console drawer state,
   and drawer height.

The config workspace is separate from the query cache. It tracks:

- The baseline config and revision.
- Raw draft values.
- Dirty paths.
- Field errors.
- `saved`, `saving`, `unsaved`, and `conflict` status.

### 8.3 Autosave behavior

Edits update the local draft immediately. The browser validates after each
edit. A 500 ms debounce begins only when the full draft passes client-side
save validation.

Invalid intermediate values remain visible. No request is sent, the field
shows an error, and the header shows Unsaved.

The server is authoritative. A successful PUT replaces the baseline and draft
with the normalized response and clears dirty state.

When `config_changed` arrives:

- An event whose revision already equals the local baseline is ignored.
- A clean workspace invalidates and refetches the config.
- A dirty or invalid workspace preserves its draft and enters conflict state.

On `409`, the UI offers exactly two actions:

- Reload Server Version, which discards the local draft after confirmation.
- Overwrite Server Version, which retries explicitly against the conflict
  revision and may conflict again.

There is no automatic merge in Phase A.

A transient network or `5xx` save failure preserves the draft, shows Save
failed, and offers Retry. It does not continuously retry or convert the request
into an overwrite.

Named-preset save is disabled while the workspace is invalid or conflicted. If
a valid autosave is pending, the action flushes and awaits that save before it
asks the server to snapshot the canonical config.

### 8.4 Form controls

The generic form renderer consumes ordered groups and fields from the schema.
Phase A provides:

- `Field` for label, tooltip, description, and error association.
- `Toggle`.
- `TextInput`.
- `NumberInput` that preserves invalid raw text while editing.
- `Select`.
- `DirectoryInput` with text entry and directory-browser action.
- `TimeInput` with numeric value and unit select.

The renderer reads and writes config values by validated schema path. It does
not interpret arbitrary server-supplied component names or HTML.

### 8.5 Console UI

The drawer and full-page route consume one console store. Terminal rows are
fixed-height and non-wrapping, which allows a small arithmetic windowing
implementation without another virtualization dependency. Horizontal overflow
scrolls.

The UI supports:

- Automatic scroll while already at the latest row.
- Pause when the user scrolls upward.
- A Jump to latest action.
- Plain substring filtering.
- Connection and dropped-gap indicators.
- Log download.

ANSI rendering supports a bounded SGR subset and constructs text spans. Output
is never assigned through `innerHTML`.

## 9. Console Capture And Events

### 9.1 Capture lifecycle

`scripts/train_ui_web.py` installs capture after argument parsing and before
Uvicorn starts. Importing `modules.webui` never changes process descriptors.

Capture performs the following:

1. Duplicate the original stdout and stderr descriptors.
2. Route fd 1 and fd 2 into one pipe.
3. Start a reader thread.
4. Tee bytes to the original terminal.
5. Incrementally decode text with replacement for malformed bytes.
6. Parse logical terminal lines.
7. Append to a bounded ring and event ingress queue.
8. Write to the rotating log sink when application config is available.

The merged stream preserves the terminal-style order observed at the pipe. The
reader never waits for the asyncio loop or a browser.

The rotating log is `webui.log` under the current canonical `workspace_dir`.
It uses one active 10 MiB file and one 10 MiB backup. On a successful workspace
change, the file sink closes and reopens under the new workspace. Failure of
the file sink does not stop terminal tee or browser streaming.

Shutdown stops capture in a defined order: flush Python streams, restore fd 1
and fd 2 to the saved originals so the pipe writers close, close any remaining
write duplicate, let the reader consume EOF, join the reader, flush parser and
log state, then close saved duplicate descriptors. The reader is never joined
while fd 1 or fd 2 still references its pipe.

### 9.2 Terminal parsing

- `\n` commits a permanent logical line.
- `\r` without `\n` replaces the current transient line.
- `\r\n` commits once.
- Chunk boundaries may split UTF-8 sequences, ANSI sequences, or line endings.
- Safe SGR sequences are retained as structured style information.
- Unsupported CSI, OSC, and control sequences are stripped.

The server retains 10,000 committed lines and one transient overwrite line,
subject to a 4 MiB UTF-8 text cap. Console events are batched at no more than
30 Hz and no more than 64 KiB per batch.

### 9.3 Sequencing and backpressure

Each server process has a random `stream_id`. Every event has a monotonic
`seq`:

```json
{
  "type": "console",
  "stream_id": "...",
  "seq": 42,
  "t": 1784710000000,
  "lines": []
}
```

Thread ingress is bounded at 2,048 batches and each client queue at 256 batches.
For a slow client, the hub drops oldest console batches and marks a sequence
gap. It coalesces config changes to the latest revision rather than dropping
the latest value. A client that remains stalled is disconnected and recovers
through backlog.

### 9.4 Race-free connection handshake

The browser avoids the REST/WS gap as follows:

1. Open the WebSocket and queue live events without rendering them.
2. Fetch `/api/events/backlog`.
3. Install its lines, transient row, `stream_id`, and cursor.
4. Merge queued live events newer than the cursor.
5. Deduplicate by `(stream_id, seq)` and enter live mode.

A changed `stream_id` means the server restarted. The client clears stale
stream state, refetches config, and repeats the handshake. Reconnection uses
capped exponential backoff. A sequence jump also repeats the backlog handshake
immediately so a dropped console batch is repaired while it remains in the
bounded ring.

Phase A verifies current-process descriptor capture on Windows and POSIX.
Child-process and multi-GPU inheritance is re-verified when training enters
scope in Phase C.

## 10. Error Handling

- Missing Bun, Python extras, or frontend build failures stop the launcher with
  exact remediation commands.
- A malformed startup config falls back to defaults with a persistent health
  warning and console error.
- Invalid browser drafts remain local and visible.
- Stale revisions preserve local work and require an explicit user choice.
- Config persistence failure leaves canonical memory and revision unchanged.
- A WebSocket outage does not disable REST configuration operations.
- A console log-file failure disables download but not terminal or browser
  streaming.
- Console capture installation failure stops the web entry point rather than
  silently launching without the Phase A pipeline.
- Directory permission and missing-path errors remain inside the picker and do
  not discard the current config value.
- Unexpected API errors show a persistent, dismissible banner and retain the
  user's local draft.

## 11. Security Posture

- Bind to `127.0.0.1` by default.
- Print a prominent no-auth warning for any non-loopback bind.
- Disable production CORS.
- In development, allow only the configured Vite origin.
- Validate browser WebSocket `Origin` against the request host.
- Limit JSON request sizes.
- Bound all queues, histories, and log files.
- Reject client secret fields and never serialize secrets.
- Constrain preset IDs beneath preset roots.
- Serve only the static build and active rotating console log as files.
- Return directory metadata but no generic file content.
- Escape all console text and support only bounded ANSI styling.

The service intentionally has no authentication in Phase A. Network exposure
is an explicit opt-in under the same single-user trust model as the native UI
and an exposed TensorBoard instance.

## 12. Dependencies And Launch

### 12.1 Python

`requirements-webui.txt` contains only the isolated web runtime dependencies:

- `fastapi`
- `uvicorn[standard]`

Existing requirement files and install behavior remain unchanged.

### 12.2 Frontend

Phase A frontend dependencies are limited to:

- Svelte 5 and SvelteKit.
- Vite and `adapter-static`.
- `@tanstack/svelte-query`.
- `lucide-svelte`.
- Frontend test tooling.

Styling uses plain CSS. The fixed-row console window is implemented locally;
no component framework, Tailwind, chart library, ANSI HTML library, or general
virtualization dependency is added in Phase A.

### 12.3 Production launcher

`web/build` and `web/node_modules` are ignored. A clean Git clone therefore
requires Bun when the web UI is first launched.

The launchers:

1. Prepare the Python runtime through existing launcher helpers.
2. Verify optional Python dependencies and Bun.
3. Compute a deterministic digest of frontend source, package metadata,
   lockfile, and build configuration.
4. If the build or local digest stamp is absent or stale, run
   `bun install --frozen-lockfile` and `bun run build`.
5. Start `scripts/train_ui_web.py` with forwarded arguments.

The build digest stamp is local and ignored. Normal launches do not rebuild an
unchanged frontend.

Production `scripts/train_ui_web.py` also refuses to start if the static build
is absent, covering direct invocation that bypasses a launcher. `--dev` permits
an absent static build because Vite serves the frontend.

`--host` defaults to `127.0.0.1`; `--port` defaults to `7801`; `--dev` enables
only the development CORS behavior. Development runs Vite on port 5173 with an
`/api` proxy to FastAPI.

## 13. Verification

### 13.1 Python unit tests

- Recursive codec shapes, enums, nullability, numeric edge cases, and unknown
  fields.
- Secret preservation and client-secret rejection.
- Revision matching, explicit overwrite, and concurrent writers.
- Rollback after decode, validation, and disk-write failures.
- Preset ID containment, migration choice, and name sanitization.
- POSIX and Windows directory-root/path behavior.
- Console parsing across arbitrary chunk boundaries.
- CR, LF, CRLF, split UTF-8, SGR, OSC, and malformed byte cases.
- Ring limits, event sequencing, slow clients, and backlog cursors.

### 13.2 API integration tests

Every Phase A endpoint is tested for its successful response and documented
error statuses using temporary config, preset, workspace, and directory roots.
Tests confirm that no response contains secrets.

### 13.3 Frontend tests

- Schema group and control rendering.
- Raw numeric draft handling.
- Debounce and save-state transitions.
- Server normalization.
- Conflict preservation, reload, overwrite, and repeated conflict.
- Pending-save preset flush and failed-save retry.
- Schema refetch after model or method changes.
- WebSocket-first backlog merge and deduplication.
- Console overwrite-row reduction and gap indicators.
- Rail persistence and mobile drawer focus behavior.

### 13.4 Browser smoke tests

Playwright covers:

- Desktop Chromium full Phase A flow.
- Phone WebKit viewport full Phase A flow.
- Firefox boot, navigation, editing, and console smoke flow.
- Launch and initial config load.
- Valid and invalid autosave.
- Two-browser revision conflict.
- Preset load/save.
- Directory picker navigation and errors.
- Console live output, CR overwrite, disconnect, backlog, and reconnect.
- Compact/expanded desktop rail and off-canvas phone rail.
- Keyboard navigation, labels, visible focus, and touch target checks.

### 13.5 Platform smoke tests

Linux and Windows runs verify launch scripts, build detection, default bind,
argument forwarding, and current-process descriptor capture. No GPU is needed.

The repository currently has no GitHub Actions workflow. Phase A supplies and
documents deterministic test commands but does not introduce unrelated CI
infrastructure. Upstream CI integration is discussed separately.

## 14. Acceptance Criteria

Phase A is complete when all of the following are true:

1. A clean supported checkout with documented optional dependencies launches
   at `http://127.0.0.1:7801` through both platform launchers.
2. The production frontend rebuilds only when missing or stale.
3. General, Data, and Backup expose the approved native fields and tooltips.
4. Desktop and phone users can complete every Phase A edit flow.
5. Valid edits autosave atomically and survive server restart.
6. Invalid intermediate edits remain visible and do not corrupt server state.
7. Concurrent browser edits cannot silently overwrite one another.
8. Preset load/save preserves secrets and honors config migrations.
9. Directory fields can browse server directories without generic file access.
10. stdout and stderr remain visible in the original terminal and browser.
11. tqdm-style carriage returns update one transient browser row.
12. Refresh and reconnect restore bounded console history without a race gap.
13. A slow browser cannot block or grow server memory without bound.
14. Non-loopback exposure is explicit and visibly warns that there is no auth.
15. The approved Python, frontend, browser, and platform verification passes.

## 15. Future Compatibility

Phase A intentionally creates these later seams:

- Phase B extends `SchemaRegistry` and adds bespoke concept/sample editors.
- Phase B extends `DirectoryService` with constrained file modes and filters.
- Phase C creates `TrainingService`, snapshots the canonical config, and adds
  training commands and callback events.
- Phase C extends the existing event envelope with progress, metric, and sample
  event types without opening a second WebSocket.
- Phase D adds the light token set and final monitoring polish.

No future phase may pass the live mutable `ConfigService` object directly into
a trainer.
