# Web UI

OneTrainer includes an optional browser-based interface alongside the desktop UI.
It offers the same training configuration, concept and dataset management, live
console output, and a sample gallery, and works on both desktop and mobile
browsers.

## Requirements

- The standard OneTrainer installation.
- Python dependencies: `pip install -r requirements-webui.txt`
- [Bun](https://bun.sh) on your PATH, used to install frontend dependencies and
  build the static bundle.

## Launching

- **Windows**: `start-web-ui.bat`
- **Linux / macOS**: `./start-web-ui.sh`

The UI is served at `http://127.0.0.1:7801`.

On first launch, and whenever frontend sources change, the launcher automatically
verifies frontend dependencies and builds the production static bundle into
`web/build`.

## Options

| Option | Effect |
| --- | --- |
| `--port 8080` | Serve on a different port |
| `--host 0.0.0.0` | Bind to all interfaces |
| `--dev` | Run the API without serving the built bundle |

**Network exposure.** Binding to a non-loopback address exposes training
control and file-system browsing to your network. Set a password under
Secrets before doing so. The password is stored as a salted scrypt hash in
`webui.json`. This is the first build to hash the password, so if you set a Web
UI password with an earlier build you will need to set it again -- the old
plaintext value in `secrets.json` is no longer read.

**Locked out?** If `webui.json` becomes unreadable (corrupt or truncated), the
Web UI treats a password as set but rejects every input, so login always fails
with no on-screen explanation. Repair or delete `webui.json` to recover;
deleting it clears the password.

For custom environment variables that affect all launch scripts (Conda/venv
selection, Python version, low-memory mode, etc.), see
[LAUNCH-SCRIPTS.md](../LAUNCH-SCRIPTS.md).

## Development

Run the API and the Vite dev server in two terminals:

```
./start-web-ui.sh --dev
cd web && bun run dev
```

See `modules/webui/README.md` for architecture and testing.
