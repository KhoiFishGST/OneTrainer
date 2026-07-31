# Web UI backend

FastAPI application serving the SvelteKit frontend in `web/`. This is an
add-on: it modifies no core OneTrainer file.

## Layout

| Path | Responsibility |
| --- | --- |
| `app.py` | App factory, middleware, router registration |
| `state.py` | `WebUISettings` and `AppState` |
| `routers/` | HTTP endpoints, one module per resource |
| `schema/` | Generates the form schema from `TrainConfig` |
| `config_io.py` | Load/save train configs, presets and secrets |
| `settings_store.py` | Web-UI-only persisted state (`webui.json`) |
| `runtime_patches.py` | Startup monkey-patches, see below |
| `gallery.py`, `media.py`, `training.py` | Sample gallery, media serving, training lifecycle |

## Endpoints

- `GET /api/datasets/video?dataset=&filename=` — Range-capable video streaming.
- `POST /api/datasets/{name}/upload` — now streams to disk and returns 415 for unsupported extensions. Publishes `dataset.file.added { dataset, filename, item_id, kind }` per saved file.
- `GET /api/datasets/{name}/files` — items now carry `kind` (`image`/`video`/`text`) and `media_name`. The former `image_name` field is removed.
- `GET /api/datasets` — dataset entries now carry `video_count`.

## Why `settings_store.py` exists

`datasets_dir` and the Web UI password are needed only by this add-on. Rather
than adding fields to the shared `TrainConfig` and `SecretsConfig` classes,
they live in `webui.json` next to `config.json`. The password is stored as a
salted scrypt hash. The file is written atomically with mode `0600`.

The store fails closed: if `webui.json` exists but cannot be read or parsed,
`has_password()` returns `True` (a broken file locks the UI down rather than
silently disabling authentication), and the setters raise
`SettingsStoreUnreadableError` instead of clobbering a file they could not
parse.

## Why `runtime_patches.py` exists

Two behaviours are needed that core does not provide, and both are installed
as runtime patches from `create_app()` rather than by editing core files:

- **`save_sampler_output`** — records the written file's path on the sampler
  output so the gallery can find it. This is the single method every concrete
  sampler writes through, and each calls it before `on_sample`, so the path is
  set before the callback runs.
- **`SummaryWriter.add_scalar`** — forwards loss and learning-rate scalars to
  the live training chart.

`install_runtime_patches()` is idempotent and lock-protected, so it is safe to
call from multiple threads. Both patches are inert when no training run is
active, so neither is ever removed.

Known limitation: `ModelSamplerOutput.__reduce__` reconstructs with only
`(file_type, data)`, so the recorded path does not survive pickling to a cloud
worker. Cloud runs do not populate the gallery.

## Testing

Tests must run in the OneTrainer venv — `TrainConfig` pulls in `torch`, and
concept statistics need `mgds`, `opencv-python` and `imagesize`.

```
./venv/bin/pip install -r requirements-webui-dev.txt
./venv/bin/python -m pytest modules/webui/tests
```

Frontend and end-to-end:

```
cd web
bun run check && bun run test && bun run build
bunx playwright test
```
