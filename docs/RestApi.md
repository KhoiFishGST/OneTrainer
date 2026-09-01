# REST API

An optional HTTP control plane for training runs. It exposes OneTrainer's existing
`TrainCallbacks` / `TrainCommands` pair over HTTP — every endpoint maps to one call on
`TrainCommands`, and every status field comes from a `TrainCallbacks` hook. No new
abstraction is introduced.

Because it binds at the same `(config, callbacks, commands)` seam that
`create.create_trainer()` uses, it controls local, multi-GPU and cloud runs with no
backend-specific code.

## Install

The server needs two extra packages, which a normal training install does not:

```
pip install -r requirements-api.txt
```

## Run

```
python scripts/train_rest_server.py --port 7800
```

The server binds `127.0.0.1` only. There is no `--host` flag: it can start training and
read files on this machine, and an exposed HTTP port has no transport security under it.
To reach it from elsewhere, put your own authenticated server in front.

## Stability

**Experimental.** There is no `/v1` prefix and no compatibility guarantee. The config
surface tracks `TrainConfig`, so it changes when `TrainConfig` changes.

## Endpoints

| Method | Path | Success |
|---|---|---|
| GET | `/health` | 200 |
| GET | `/config/defaults` | 200 |
| POST | `/training/start` | 202 |
| POST | `/training/stop` | 202 |
| POST | `/training/sample` | 202 |
| POST | `/training/backup` | 202 |
| POST | `/training/save` | 202 |
| GET | `/training/status` | 200 |

Commands answer `202 Accepted`, not `200`: `TrainCommands` are polled by the trainer at
step boundaries, so `stop` raises a flag rather than stopping anything synchronously.

## Starting a run

The body mirrors `scripts/train.py`'s arguments. Give exactly one of `config` (an inline
`TrainConfig` document) or `config_path`:

```
curl -X POST http://127.0.0.1:7800/training/start \
  -H 'Content-Type: application/json' \
  -d '{"config_path": "configs/my-run.json"}'
```

```json
{
  "config":        {},
  "config_path":   "configs/my-run.json",
  "preset_path":   "training_presets/#sdxl_lora.json",
  "config_values": ["epochs=10", "cloud.enabled=true"],
  "secrets_path":  "secrets.json"
}
```

`preset_path` and `config_values` are optional and apply in the CLI's order:
preset → config → overrides.

Each `config_values` entry is `KEY=VALUE`, where `KEY` may use dot notation to reach a
nested config object (`cloud.enabled`) — the same form as the CLI's `--config-value`.
An unknown key is rejected with `422` rather than ignored, so a typo fails immediately
instead of starting a run with settings you did not ask for.

### Secrets

**Credentials are never accepted over the wire.** They resolve server-side from
`secrets_path` (default `secrets.json`), exactly as `scripts/train.py` does. A request
carrying a `secrets` block inline, or a `config_values` override whose key starts with
`secrets.`, is rejected with `422`. No response body ever contains secrets.

## Checking on a run

```
curl http://127.0.0.1:7800/training/status
```

```json
{
  "run_id": "9f2c1a4e8b7d4c31",
  "state": "running",
  "message": "caching",
  "epoch": 3,
  "max_epochs": 10,
  "epoch_step": 142,
  "epoch_length": 500,
  "step": 1420,
  "max_steps": 5000,
  "started_at": "2026-08-04T15:12:03Z",
  "elapsed_seconds": 912.4,
  "error": null
}
```

`epoch` is 0-based. `epoch_length` is the trainer's steps-per-epoch, and `max_steps` is
`epoch_length * max_epochs`. Speed and ETA are deliberately not reported — derive them
from these counters if you want them.

States: `idle`, `starting`, `running`, `stopping`, `completed`, `failed`, `canceled`.
The three terminal states are distinct so a client knows whether to go looking for output,
and they persist until the next run starts, so polling late still tells you what happened.

**Known limitation:** a `stop` issued while the state is `starting` is not honored until
the training loop begins, because the stop flag is only polled at step boundaries.

## Errors

Every non-2xx response uses one shape:

```json
{ "error": { "type": "conflict", "message": "...", "details": {} } }
```

Types: `invalid_config` (422), `conflict` (409), `no_active_run` (409), `internal` (500).
A `conflict` on `start` carries the active `run_id` in `details`.

## Sampling

`POST /training/sample` with no body requests the default sample. With
`{"sample": {...}}` — a `SampleConfig` document — it requests a custom one.
