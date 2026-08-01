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

## Datasets

- Files upload one at a time with a visible per-file progress bar, three at once.
- Individual files can be canceled while uploading and retried after a failure; one failed file no longer discards the batch.
- Uploads continue in the background when you navigate to another page.
- Datasets accept video: `.webm .mkv .flv .avi .mov .wmv .mp4 .mpeg .m4v`. Videos show an extracted poster frame in the grid and play in the lightbox. `.mkv`, `.avi`, `.wmv`, `.flv`, and `.mpeg` are supported for training but cannot be previewed in a browser, so the lightbox shows a notice instead of a player.

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

## Appearance and motion

Theme and animation preferences live under **General → Web UI**.

The app's motion feel (Material-aligned/Standard) is a single set of
`--motion-*` custom properties in `web/src/app.css`, inside the
`/* motion-tokens:start */` … `/* motion-tokens:end */` markers. Everything
that animates references these tokens and nothing else, so retuning the whole
app is an edit to that one block:

| Token | Value |
| --- | --- |
| `--motion-duration-enter` | 200ms |
| `--motion-duration-exit` | 150ms |
| `--motion-duration-layout` | 300ms |
| `--motion-ease-enter` | `cubic-bezier(0, 0, 0.2, 1)` |
| `--motion-ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` |
| `--motion-travel` | 8px |
| `--motion-scale` | 0.98 |

Two relationships are deliberate and should not be "normalised" away: exits
are faster than entrances (an entrance is information, an exit is an
obstacle), and `--motion-duration-layout` is longer than the enter/exit
durations because the rail travels 112px and the console drawer travels its
full height, versus 8px for overlays -- 112px crammed into 200ms would read as
a snap.

There are two kill switches, and they compose one-way:

- `html[data-motion="off"]` is the user's Animations toggle.
- `@media (prefers-reduced-motion: reduce)` is the OS preference.

The OS preference always wins -- the app's Animations toggle can never
re-enable motion against it. Both switches zero the duration tokens to
`0.01ms` (and drop travel/scale to no-ops) rather than setting
`animation: none`, because bits-ui keeps a closing overlay mounted in the DOM
until its `animationend` fires; removing the animation entirely would strand
it there.

Svelte's transition system takes plain numbers, not CSS custom properties, so
the same scale is mirrored in `web/src/lib/motion.ts` as `MOTION` and
`motionEnabled()` (which composes the two kill switches the same one-way
fashion). `motion.test.ts` parses `app.css` and fails if the two ever drift
apart, so change both together.

Preferences persist in `webui.json` under an `appearance` key
(`{"theme": "light"|"dark"|"system", "animations": true|false}`), served by
`GET`/`PUT /api/appearance`. `PUT` accepts a partial body, so the UI only
sends the field the user just changed. `localStorage`
(`webui.theme`, `webui.animations`) is a pre-paint cache applied by a
blocking script in `web/src/app.html` so the first frame renders with the
right theme and motion state before the app boots; `webui.json` remains the
source of truth, and the appearance store reconciles against it once its
query resolves.

## Development

Run the API and the Vite dev server in two terminals:

```
./start-web-ui.sh --dev
cd web && bun run dev
```

See `modules/webui/README.md` for architecture and testing.
