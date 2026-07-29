# Web UI Load Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut cold-load LCP of the OneTrainer Web UI from ~4.4 s back to well under 2 s by compressing and caching static assets, and by removing the whole application shell from the login page's and first paint's critical path.

**Architecture:** Two independent levers. Server side: a selective gzip middleware plus `Cache-Control: immutable` on content-hashed assets in the FastAPI app. Client side: a SvelteKit route group that keeps `/login` out of the app-shell layout, plus dynamic imports for the shell's modal/drawer UI so `vaul`, the bits-ui dialog machinery, and the console view leave the first-paint bundle. A Playwright budget spec locks the wins in.

**Tech Stack:** FastAPI / Starlette 0.47 / uvicorn (Python 3.10+), SvelteKit 2 + Svelte 5 (runes) with `adapter-static` in SPA mode (`ssr = false`), TanStack Svelte Query 5, bits-ui / shadcn-svelte, Tailwind v4, Vitest, Playwright, pytest.

## Global Constraints

- Python line length 120, double-quoted strings, ruff lint config in `pyproject.toml`. First-party imports are `modules`; import section order is enforced by ruff isort.
- Run Python tests with `python -m pytest tests/webui -q` from the repo root. Note the active env is `/home/khoifish/GST/gst-venv`, **not** the repo's `venv/` (which has no pytest).
- Run web unit tests with `bun run test` from `web/`. Baseline at plan time: **59 files, 317 tests passing**.
- Run e2e with `bun run build && bunx playwright test` from `web/`. The e2e fixture server (`tests/webui/e2e_server.py`) serves `web/build`, so **e2e always requires a fresh `bun run build` first**.
- SvelteKit route groups (`(name)/`) do **not** appear in URLs. Every public path in this plan stays byte-identical: `/live`, `/login`, `/general`, `/datasets/[id]`, etc.
- Do not change any user-visible copy, ARIA labels, `data-testid`s, or CSS class names. The visual regression suite (`e2e/visual.spec.ts-snapshots/`) must keep passing without regenerating baselines.
- The UI dependency boundary test (`src/lib/components/ui-dependency-boundary.test.ts`) forbids `$lib/components/ui/**` from importing anything outside `$lib/components/ui/` and `$lib/utils`. Do not add imports there.
- Commit after every task. Conventional Commit prefixes, matching repo history (`fix(web):`, `perf(web):`, `perf(webui):`, `test(web):`).

## Measured Baseline (reproduced before this plan)

Chromium, emulated Fast 3G (150 ms RTT, 1.6 Mbps down), cold load of `/` → `/login`:

| Metric | Pre-shadcn (`65732774`) | Current `HEAD` | Target |
|---|---|---|---|
| LCP | 2100 ms | **4376 ms** | < 1500 ms |
| DOMContentLoaded | 1139 ms | 3322 ms | < 900 ms |
| Critical-path bytes | 259 KB raw / 92 KB gzip | 720 KB raw / 217 KB gzip | < 250 KB raw on `/login` |
| `/_app/` files fetched for `/login` | — | **48** | ≤ 20 |

Confirmed causes: (a) the server sends `Content-Length: 123109` with no `content-encoding` even when the client sends `Accept-Encoding: gzip`, and sets no `Cache-Control` on `/_app/immutable/*`; (b) `src/routes/+layout.svelte` statically imports `LayoutContent`, which statically imports `Header`, `Rail`, `StatusBar`, `ConsoleDrawer`, `ErrorBanner`, `DirectoryPicker`, `Toaster` and `SidebarProvider`, dragging `@floating-ui` (51 KB), `vaul` (49 KB), bits-ui dialog machinery (~110 KB), `sonner` and lucide (87 KB) in before first paint — even on `/login`, which renders none of it.

## File Structure

**Python**
- `modules/webui/compression.py` *(new)* — `SelectiveGZipMiddleware`; owns the "what is worth compressing" policy.
- `modules/webui/app.py` *(modified)* — installs the middleware; adds `Cache-Control` to static `FileResponse`s.
- `tests/webui/test_static_delivery.py` *(new)* — asserts compression and caching behaviour.

**Web**
- `web/src/lib/api/query-client.ts` *(new)* — `createAppQueryClient()`, single source of truth for query defaults incl. the retry policy.
- `web/src/lib/api/query-client.test.ts` *(new)*.
- `web/src/routes/+layout.svelte` *(modified)* — reduced to a bare shell: `app.css` + `{@render children()}`.
- `web/src/routes/(app)/+layout.svelte` *(new)* — `QueryClientProvider` + `LayoutContent`; the app shell.
- `web/src/routes/(app)/<route>/**` *(moved)* — every route except `login` and the root `+page.ts`.
- `web/src/lib/components/LayoutContent.svelte` *(modified)* — drops the dead `/login` branch; lazy-loads `DirectoryPicker` and `ConsoleDrawer`.
- `web/src/lib/components/critical-path-boundary.test.ts` *(new)* — source scan asserting first-paint modules never statically import heavy overlays. Owns the `CRITICAL_PATH_MODULES` allowlist that Tasks 5 and 6 both edit.
- `web/src/lib/components/shell/Header.svelte` *(modified)* — lazy-loads its save drawer and overwrite alert dialog.
- `web/src/routes/login/+page.svelte` *(modified)* — client-side `goto` instead of `window.location.href`.
- `web/e2e/perf-budget.spec.ts` *(new)* — regression guard on request count and bytes.
- `web/playwright.config.ts` *(modified)* — registers the budget spec with the `chromium-desktop` project.

---

### Task 1: Compress and cache static assets

Server-side only. No web changes. This alone took measured LCP from 4376 ms to 2244 ms.

**Files:**
- Create: `modules/webui/compression.py`
- Modify: `modules/webui/app.py` (imports near line 44; middleware install after the `auth_middleware` definition that ends at line 230; the three `FileResponse` returns at lines 268, 277, 282)
- Test: `tests/webui/test_static_delivery.py`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `modules.webui.compression.SelectiveGZipMiddleware(app, minimum_size: int = 1024, compresslevel: int = 6)`; module constants `INCOMPRESSIBLE_SUFFIXES: tuple[str, ...]` and `INCOMPRESSIBLE_PATH_PREFIXES: tuple[str, ...]`. Also `modules.webui.app.IMMUTABLE_CACHE_CONTROL: str`.

**Background the implementer needs:**
Starlette 0.47's `GZipMiddleware` excludes only `text/event-stream`, so it would happily burn CPU gzipping already-compressed JPEG/PNG gallery thumbnails on the single-threaded event loop. Hence the selective wrapper. Also note: `create_app` registers `auth_middleware` via `@app.middleware("http")` (i.e. `BaseHTTPMiddleware`), which turns every response into a streaming one. A consequence is that `minimum_size` is effectively bypassed and even small JSON bodies get compressed — that is harmless, but **do not write a test asserting that small responses are left uncompressed**, it will fail.

- [ ] **Step 1: Write the failing test**

Create `tests/webui/test_static_delivery.py`:

```python
from modules.webui.app import IMMUTABLE_CACHE_CONTROL, create_app
from modules.webui.state import WebUISettings

from fastapi.testclient import TestClient


def _make_client(tmp_path):
    static_dir = tmp_path / "static"
    (static_dir / "_app" / "immutable" / "chunks").mkdir(parents=True)
    (static_dir / "index.html").write_text("<html>index</html>" * 200, encoding="utf-8")
    (static_dir / "_app" / "immutable" / "chunks" / "big.js").write_text("x=1;" * 5000, encoding="utf-8")
    (static_dir / "logo.png").write_bytes(b"\x89PNG\r\n\x1a\n" + bytes(range(256)) * 40)

    settings = WebUISettings(
        root_dir=tmp_path,
        config_path=tmp_path / "config.json",
        secrets_path=tmp_path / "secrets.json",
        presets_dir=tmp_path / "presets",
        static_dir=static_dir,
        dev=False,
    )
    return TestClient(create_app(settings))


def test_javascript_assets_are_gzipped(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/_app/immutable/chunks/big.js", headers={"accept-encoding": "gzip"})
        assert res.status_code == 200
        assert res.headers["content-encoding"] == "gzip"
        assert res.headers["vary"] == "Accept-Encoding"


def test_images_are_not_gzipped(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/logo.png", headers={"accept-encoding": "gzip"})
        assert res.status_code == 200
        assert "content-encoding" not in res.headers


def test_clients_without_gzip_support_still_get_the_asset(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/_app/immutable/chunks/big.js", headers={"accept-encoding": "identity"})
        assert res.status_code == 200
        assert "content-encoding" not in res.headers
        assert res.text.startswith("x=1;")


def test_hashed_assets_are_cached_immutably(tmp_path):
    with _make_client(tmp_path) as client:
        res = client.get("/_app/immutable/chunks/big.js")
        assert res.headers["cache-control"] == IMMUTABLE_CACHE_CONTROL
        assert IMMUTABLE_CACHE_CONTROL == "public, max-age=31536000, immutable"


def test_index_html_is_never_cached_immutably(tmp_path):
    with _make_client(tmp_path) as client:
        for path in ("/", "/general"):
            res = client.get(path)
            assert res.status_code == 200
            assert res.headers.get("cache-control") != IMMUTABLE_CACHE_CONTROL
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/webui/test_static_delivery.py -v`
Expected: FAIL at collection with `ImportError: cannot import name 'IMMUTABLE_CACHE_CONTROL' from 'modules.webui.app'`.

- [ ] **Step 3: Create the compression middleware**

Create `modules/webui/compression.py`:

```python
from starlette.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Receive, Scope, Send

# Payloads that are already compressed. Gzipping them costs event-loop CPU for
# no meaningful size win, which matters because gallery thumbnails are served
# from the same single-threaded loop that drives training events.
INCOMPRESSIBLE_SUFFIXES = (
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".avif",
    ".ico",
    ".mp4",
    ".webm",
    ".mp3",
    ".ogg",
    ".wav",
    ".woff",
    ".woff2",
    ".zip",
    ".gz",
    ".safetensors",
)

# API routes that stream image bytes rather than JSON.
INCOMPRESSIBLE_PATH_PREFIXES = (
    "/api/datasets/image",
    "/api/gallery/runs/",
    "/api/training/samples/",
)


class SelectiveGZipMiddleware:
    """Gzip text payloads, pass binary media through untouched."""

    def __init__(self, app: ASGIApp, minimum_size: int = 1024, compresslevel: int = 6) -> None:
        self.app = app
        self.gzip_app = GZipMiddleware(app, minimum_size=minimum_size, compresslevel=compresslevel)

    @staticmethod
    def is_incompressible(path: str) -> bool:
        lowered = path.lower()
        if lowered.endswith(INCOMPRESSIBLE_SUFFIXES):
            return True
        return lowered.startswith(INCOMPRESSIBLE_PATH_PREFIXES)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.is_incompressible(scope.get("path", "")):
            await self.app(scope, receive, send)
            return
        await self.gzip_app(scope, receive, send)
```

- [ ] **Step 4: Wire it into the app**

In `modules/webui/app.py`, add to the first-party import block (alphabetically, so directly after the `config_service` import near line 21):

```python
from modules.webui.compression import SelectiveGZipMiddleware
```

Add this module-level constant next to `MAX_BODY_SIZE` (around line 56):

```python
IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"
```

Then, immediately **after** the `auth_middleware` function body ends (after its `return await call_next(request)` at line 230) and before the `if settings.dev:` CORS block, add:

```python
    # Added last among request-path middleware so it wraps everything below it,
    # including auth redirects and the static file handler.
    app.add_middleware(SelectiveGZipMiddleware)
```

- [ ] **Step 5: Add cache headers to hashed assets**

In `modules/webui/app.py`, replace the body of `serve_static_or_spa` (lines 262-282) with:

```python
        async def serve_static_or_spa(full_path: str):
            if full_path.startswith("api/") or full_path == "api":
                raise HTTPException(status_code=404, detail="Not Found")

            rel_path = full_path.lstrip("/")
            if not rel_path:
                return FileResponse(index_file)

            try:
                target_path = (static_root / rel_path).resolve()
                target_path.relative_to(static_root)
            except (ValueError, RuntimeError) as err:
                raise HTTPException(status_code=400, detail="Invalid path") from err

            if target_path.is_file():
                # Everything under _app/immutable has a content hash in its
                # filename, so it can never go stale.
                if rel_path.startswith("_app/immutable/"):
                    return FileResponse(target_path, headers={"cache-control": IMMUTABLE_CACHE_CONTROL})
                return FileResponse(target_path)

            if Path(rel_path).suffix != "":
                raise HTTPException(status_code=404, detail="Not Found")

            return FileResponse(index_file)
```

- [ ] **Step 6: Run the new tests**

Run: `python -m pytest tests/webui/test_static_delivery.py -v`
Expected: 5 passed.

- [ ] **Step 7: Run the full Python suite for regressions**

Run: `python -m pytest tests/webui -q`
Expected: 202 passed (197 baseline + 5 new).

- [ ] **Step 8: Lint**

Run: `ruff check modules/webui/compression.py modules/webui/app.py tests/webui/test_static_delivery.py`
Expected: `All checks passed!`

- [ ] **Step 9: Commit**

```bash
git add modules/webui/compression.py modules/webui/app.py tests/webui/test_static_delivery.py
git commit -m "perf(webui): gzip text assets and cache hashed bundles immutably"
```

---

### Task 2: Stop retrying authentication failures

Measured: the login page fired `/api/config` **3 times** (all 401) and opened the `/api/events` WebSocket **4 times** in 6 seconds. Task 3 removes the login-page case entirely, but a 4xx is never worth retrying anywhere, and extracting the config makes Task 3's move mechanical.

**Files:**
- Create: `web/src/lib/api/query-client.ts`
- Test: `web/src/lib/api/query-client.test.ts`
- Modify: `web/src/routes/+layout.svelte`

**Interfaces:**
- Consumes: `ApiError` from `$lib/api/client` (exported class with a public `status: number` field).
- Produces: `createAppQueryClient(): QueryClient` and `shouldRetryQuery(failureCount: number, error: unknown): boolean`, both exported from `$lib/api/query-client`. Task 3 imports `createAppQueryClient`.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/api/query-client.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ApiError } from './client';
import { createAppQueryClient, shouldRetryQuery } from './query-client';

describe('shouldRetryQuery', () => {
  it('never retries client errors such as an expired session', () => {
    expect(shouldRetryQuery(0, new ApiError(401, 'Authentication required'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(403, 'Forbidden'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(404, 'Not Found'))).toBe(false);
  });

  it('retries server errors a bounded number of times', () => {
    const error = new ApiError(503, 'Service Unavailable');
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it('retries transport failures that carry no status', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(false);
  });
});

describe('createAppQueryClient', () => {
  it('applies the shared defaults', () => {
    const defaults = createAppQueryClient().getDefaultOptions().queries;
    expect(defaults?.staleTime).toBe(1000 * 60);
    expect(defaults?.refetchOnWindowFocus).toBe(false);
    expect(defaults?.retry).toBe(shouldRetryQuery);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `web/`: `bun run test -- src/lib/api/query-client.test.ts`
Expected: FAIL — `Failed to resolve import "./query-client"`.

- [ ] **Step 3: Write the implementation**

Create `web/src/lib/api/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/svelte-query';
import { ApiError } from './client';

const MAX_RETRIES = 1;

/**
 * Retrying a 4xx cannot succeed — the request was wrong, not unlucky. Retrying
 * a 401 in particular used to fire three backed-off requests per query while
 * the user sat on the login page.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRIES;
}

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `web/`: `bun run test -- src/lib/api/query-client.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Use it in the root layout**

Replace the whole of `web/src/routes/+layout.svelte` with:

```svelte
<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import LayoutContent from '$lib/components/LayoutContent.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import { createAppQueryClient } from '$lib/api/query-client';
  import '../app.css';

  const queryClient = createAppQueryClient();

  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <LayoutContent>
    {@render children()}
  </LayoutContent>
  <Toaster />
</QueryClientProvider>
```

- [ ] **Step 6: Run the full web suite**

Run from `web/`: `bun run test`
Expected: 60 files, 321 tests passing.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/api/query-client.ts web/src/lib/api/query-client.test.ts web/src/routes/+layout.svelte
git commit -m "fix(web): stop retrying 4xx responses in query defaults"
```

---

### Task 3: Keep the login page out of the app shell

The single biggest client-side win. Today `/login` downloads 48 `/_app/` files — the entire shell, `@floating-ui`, `vaul`, sonner, lucide, TanStack Query — to render a password box it then hides behind `{#if currentPath === '/login'}`. A SvelteKit route group moves the shell into a layout that `/login` simply never enters.

**Files:**
- Create: `web/src/routes/(app)/+layout.svelte`
- Move: every directory under `web/src/routes/` **except** `login/`, plus the root `+layout.svelte`/`+layout.ts`/`+page.ts` which stay put
- Modify: `web/src/routes/+layout.svelte`, `web/src/lib/components/LayoutContent.svelte`, `web/src/lib/components/LayoutContent.test.ts`

**Interfaces:**
- Consumes: `createAppQueryClient` from `$lib/api/query-client` (Task 2).
- Produces: no new exports. `LayoutContent` loses its `/login` branch; its rendered markup for every non-login path is unchanged.

**Background the implementer needs:**
A parenthesised directory is a SvelteKit *route group*: it participates in layout inheritance but contributes nothing to the URL. `src/routes/(app)/general/+page.svelte` still serves `/general`. Because `src/routes/+layout.ts` sets `ssr = false` and `prerender = false`, and those settings are inherited by every child, they must stay at the **root**, not move into the group.

- [ ] **Step 1: Write the failing test**

Add to `web/src/lib/components/LayoutContent.test.ts`, inside the existing `describe('LayoutContent', ...)` block, directly after the existing `it(...)`:

```ts
  it('always renders the application shell, because login lives outside this layout', () => {
    renderLayoutContent();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
```

And at the top of the same file, replace the existing `$app/stores` mock with one pointing at `/login`, to prove the shell no longer special-cases it:

```ts
vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/login') }),
}));
```

- [ ] **Step 2: Run test to verify it fails**

Run from `web/`: `bun run test -- src/lib/components/LayoutContent.test.ts`
Expected: FAIL — `Unable to find an accessible element with the role "main"`, because the current `{#if currentPath === '/login'}` branch renders only the children.

- [ ] **Step 3: Remove the dead login branch from LayoutContent**

In `web/src/lib/components/LayoutContent.svelte`, delete the `{#if currentPath === '/login'}` wrapper so the shell renders unconditionally. Change the markup from:

```svelte
{#if currentPath === '/login'}
  {#if children}
    {@render children()}
  {/if}
{:else}
  <SidebarProvider class="app-shell flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
```

to:

```svelte
<SidebarProvider class="app-shell flex flex-col h-screen w-screen overflow-hidden bg-background text-foreground">
```

and at the very end of the file remove the final `{/if}` that closes that block, leaving `</SidebarProvider>` as the last markup line. Leave the `currentPath` derived value in place — `Rail` still needs it.

- [ ] **Step 4: Run test to verify it passes**

Run from `web/`: `bun run test -- src/lib/components/LayoutContent.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Move the application routes into a route group**

Run from the repo root:

```bash
mkdir -p web/src/routes/\(app\)
for d in backup concepts console data datasets embeddings gallery general live lora lora-embedding model sampling secrets training; do
  git mv "web/src/routes/$d" "web/src/routes/(app)/$d"
done
```

`web/src/routes/login/`, `web/src/routes/+layout.svelte`, `web/src/routes/+layout.ts` and `web/src/routes/+page.ts` all stay where they are.

Verify the result:

```bash
ls web/src/routes
```

Expected exactly: `(app)`, `+layout.svelte`, `+layout.ts`, `+page.ts`, `login`.

- [ ] **Step 6: Create the app-group layout**

Create `web/src/routes/(app)/+layout.svelte`:

```svelte
<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import LayoutContent from '$lib/components/LayoutContent.svelte';
  import { createAppQueryClient } from '$lib/api/query-client';

  const queryClient = createAppQueryClient();

  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <LayoutContent>
    {@render children()}
  </LayoutContent>
</QueryClientProvider>
```

- [ ] **Step 7: Reduce the root layout to a bare shell**

Replace the whole of `web/src/routes/+layout.svelte` with:

```svelte
<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

{@render children()}
```

The `Toaster` is not lost — `LayoutContent` already renders its own, so the copy in the old root layout was a duplicate. `app.css` must stay here because the login page uses the same theme tokens and Tailwind utilities.

- [ ] **Step 8: Verify types and run the full suite**

Run from `web/`: `bun run check && bun run test`
Expected: `svelte-check` reports 0 errors; 60 files, 322 tests passing.

- [ ] **Step 9: Verify the login page no longer pulls the shell**

Run from `web/`:

```bash
bun run build
python - <<'PY'
import json, os, re
manifest = json.load(open('.svelte-kit/output/client/.vite/manifest.json'))
html = open('build/index.html').read()
preloaded = [f for f in re.findall(r'href="(/_app/[^"]+)"', html) if os.path.exists('build' + f)]
total = sum(os.path.getsize('build' + f) for f in preloaded)
print(f"index.html critical path: {len(preloaded)} files, {total/1024:.0f} KB")
PY
```

Expected: substantially fewer than the 44 files / 720 KB baseline. Record the numbers — Task 7 turns them into an assertion.

- [ ] **Step 10: Run e2e to confirm no route regressed**

Run from `web/`: `bunx playwright test`
Expected: all specs pass, including `e2e/accessibility.spec.ts`'s two `/login` cases and the visual snapshots.

- [ ] **Step 11: Commit**

```bash
git add web/src/routes web/src/lib/components/LayoutContent.svelte web/src/lib/components/LayoutContent.test.ts
git commit -m "perf(web): keep the login page out of the application shell layout"
```

---

### Task 4: Navigate client-side after login

`login/+page.svelte:33` does `window.location.href = '/'`, which throws away the freshly-parsed bundle, re-downloads everything, and then eats a server `307` from `/` to `/live`. The session cookie is already set by the `fetch`, so a client-side `goto` straight to `/live` is enough.

**Files:**
- Modify: `web/src/routes/login/+page.svelte` (imports at line 1-6; `handleLogin` at lines 23-46)
- Test: `web/src/routes/login/page.test.ts`

**Interfaces:**
- Consumes: `goto` from `$app/navigation`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing test**

In `web/src/routes/login/page.test.ts`, add this mock directly below the existing imports at the top of the file:

```ts
import { goto } from '$app/navigation';

vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
}));
```

Then add this test inside the existing `describe('Login Page', ...)` block:

```ts
  it('navigates client-side to the app on a successful login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok' }) }));

    render(Page);
    await fireEvent.input(screen.getByLabelText('Password'), { target: { value: 'correct-horse' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(fetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({ method: 'POST' }));
    expect(goto).toHaveBeenCalledWith('/live');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run from `web/`: `bun run test -- src/routes/login/page.test.ts`
Expected: FAIL — `expected "goto" to be called with arguments: [ '/live' ]`, received zero calls.

- [ ] **Step 3: Write the implementation**

In `web/src/routes/login/+page.svelte`, add to the imports:

```ts
  import { goto } from '$app/navigation';
```

and change the success branch of `handleLogin` from:

```ts
      if (res.ok) {
        window.location.href = '/';
      } else {
```

to:

```ts
      if (res.ok) {
        // The session cookie is set by the response above, so a client-side
        // navigation is enough — a full reload would re-download the bundle
        // and then eat a server redirect from / to /live.
        await goto('/live');
      } else {
```

- [ ] **Step 4: Run test to verify it passes**

Run from `web/`: `bun run test -- src/routes/login/page.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Run the full web suite**

Run from `web/`: `bun run test`
Expected: 60 files, 323 tests passing.

- [ ] **Step 6: Commit**

```bash
git add web/src/routes/login/+page.svelte web/src/routes/login/page.test.ts
git commit -m "perf(web): navigate client-side after a successful login"
```

---

### Task 5: Lazy-load the shell's picker and console drawer

`DirectoryPicker` (pulls `ResponsiveDialogSheet` → bits-ui `Dialog` + `Sheet`) and `ConsoleDrawer` (pulls `ConsoleView` and its stylesheet — `ConsoleView…css` is preloaded in `index.html` today) are both mounted by `LayoutContent` on every page but visible only once the user opens them.

**Files:**
- Create: `web/src/lib/components/critical-path-boundary.test.ts`
- Modify: `web/src/lib/components/LayoutContent.svelte` (imports at lines 18 and 20; markup for `ConsoleDrawer` and `DirectoryPicker`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `findStaticImports(source: string): string[]`, exported from `critical-path-boundary.test.ts`, plus the `CRITICAL_PATH_MODULES: Record<string, string[]>` map that Task 6 extends. `DirectoryPicker` and `ConsoleDrawer` keep identical props and behaviour once mounted.

**Background the implementer needs:**
In Svelte 5, a dynamically imported component is held in `$state` and rendered through a capitalised variable. Because both components are only rendered once their open flag is true, mounting them on demand is behaviourally equivalent — `ConsoleDrawer` already wraps its entire markup in `{#if open}`, and `DirectoryPicker` is a modal.

The test below follows the source-scanning boundary pattern this repo already uses in `src/lib/components/style-boundary.test.ts` and `ui-dependency-boundary.test.ts` (`import.meta.glob` with `query: '?raw'`). A DOM assertion cannot detect eager *importing* — only a source scan can.

- [ ] **Step 1: Write the failing test**

Create `web/src/lib/components/critical-path-boundary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

const svelteSources = import.meta.glob('/src/**/*.svelte', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/**
 * Modules that render before first paint, mapped to the heavy overlay
 * dependencies they must not pull in statically. Every entry here was measured
 * as sitting in the root-layout chunk graph; a static import puts it on the
 * critical path even though the user may never open the overlay.
 */
export const CRITICAL_PATH_MODULES: Record<string, string[]> = {
  '/src/lib/components/LayoutContent.svelte': [
    './shell/ConsoleDrawer.svelte',
    './directory/DirectoryPicker.svelte',
  ],
};

/**
 * Returns the specifiers of static `import ... from '...'` statements only.
 * A dynamic `import('...')` starts with `import(`, so it is skipped.
 */
export function findStaticImports(source: string): string[] {
  const specifiers: string[] = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!/^import\s/.test(trimmed)) continue;
    const match = trimmed.match(/['"]([^'"]+)['"]/);
    if (match) specifiers.push(match[1]);
  }
  return specifiers;
}

describe('critical path boundary', () => {
  it('detects a static component import', () => {
    expect(findStaticImports("import Drawer from './shell/ConsoleDrawer.svelte';")).toEqual([
      './shell/ConsoleDrawer.svelte',
    ]);
  });

  it('ignores dynamic imports and type-position imports', () => {
    expect(findStaticImports("const m = import('./shell/ConsoleDrawer.svelte');")).toEqual([]);
    expect(
      findStaticImports("let C = $state<typeof import('./shell/ConsoleDrawer.svelte').default | null>(null);")
    ).toEqual([]);
  });

  it('keeps heavy overlays off the first-paint graph', () => {
    const violations = Object.entries(CRITICAL_PATH_MODULES).flatMap(([file, forbidden]) => {
      const source = svelteSources[file];
      if (source === undefined) return [`${file}: not found — did the file move?`];
      const imported = findStaticImports(source);
      return forbidden
        .filter((specifier) => imported.includes(specifier))
        .map((specifier) => `${file}: statically imports ${specifier}; use a dynamic import()`);
    });
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `web/`: `bun run test -- src/lib/components/critical-path-boundary.test.ts`
Expected: FAIL on the third test with two violations — `LayoutContent.svelte: statically imports ./shell/ConsoleDrawer.svelte` and `... ./directory/DirectoryPicker.svelte`. The first two tests pass.

- [ ] **Step 3: Replace the static imports with dynamic ones**

In `web/src/lib/components/LayoutContent.svelte`, delete these two import lines:

```ts
  import ConsoleDrawer from './shell/ConsoleDrawer.svelte';
  import DirectoryPicker from './directory/DirectoryPicker.svelte';
```

and add the following directly after the existing `let eventClient = $state<EventClient | null>(null);` declaration, so both effects sit below the `drawerOpen` and `pickerOpen` state they read:

```ts
  // Both are overlays: nothing renders them until the user opens one, so
  // keeping them out of the first-paint graph costs nothing at runtime.
  let ConsoleDrawer = $state<typeof import('./shell/ConsoleDrawer.svelte').default | null>(null);
  let DirectoryPicker = $state<typeof import('./directory/DirectoryPicker.svelte').default | null>(null);

  $effect(() => {
    if (drawerOpen && !ConsoleDrawer) {
      import('./shell/ConsoleDrawer.svelte').then((module) => {
        ConsoleDrawer = module.default;
      });
    }
  });

  $effect(() => {
    if (pickerOpen && !DirectoryPicker) {
      import('./directory/DirectoryPicker.svelte').then((module) => {
        DirectoryPicker = module.default;
      });
    }
  });
```

- [ ] **Step 4: Guard both render sites**

In the same file, change:

```svelte
        <ConsoleDrawer open={drawerOpen && currentPath !== '/console'} onClose={closeDrawer} store={consoleStore} />
```

to:

```svelte
        {#if ConsoleDrawer}
          <ConsoleDrawer open={drawerOpen && currentPath !== '/console'} onClose={closeDrawer} store={consoleStore} />
        {/if}
```

and wrap the `<DirectoryPicker ... />` element (which spans from `<DirectoryPicker` to its closing `/>`) in:

```svelte
    {#if DirectoryPicker}
      <DirectoryPicker
        open={pickerOpen}
        initialPath={pickerInitialPath}
        mode={pickerMode}
        extensions={pickerExtensions}
        onSelect={(selectedPath) => {
          if (pickerOnSelect) {
            pickerOnSelect(selectedPath);
          }
          pickerOpen = false;
        }}
        onClose={() => {
          pickerOpen = false;
        }}
      />
    {/if}
```

- [ ] **Step 5: Run the full web suite**

Run from `web/`: `bun run check && bun run test`
Expected: 0 type errors; 61 files, 326 tests passing.

- [ ] **Step 6: Confirm the chunks left the critical path**

Run from `web/`:

```bash
bun run build
grep -c 'ConsoleView\|DirectoryPicker' build/index.html || echo "0 — both removed from the preload list"
```

Expected: `0 — both removed from the preload list`. Before this task, `index.html` preloads `ConsoleView…css` and `DirectoryPicker…css`.

- [ ] **Step 7: Run e2e — these paths are heavily covered**

Run from `web/`: `bunx playwright test`
Expected: all pass. `e2e/console.spec.ts`, `e2e/phase-a.spec.ts` and `e2e/responsive-workflows.spec.ts` exercise the drawer and the picker; Playwright's locator auto-waiting absorbs the dynamic import latency.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/components/LayoutContent.svelte web/src/lib/components/critical-path-boundary.test.ts
git commit -m "perf(web): load the directory picker and console drawer on demand"
```

---

### Task 6: Lazy-load the header's save dialogs

`Header.svelte` statically imports `ResponsiveDialogDrawer` (the only critical-path consumer of `vaul-svelte`, ~49 KB) and `AlertDialog`. Both are shown only while saving a preset.

Do **not** attempt the same for `StatusBar`'s `DropdownMenu`: `@floating-ui` also arrives via `ui/sidebar/sidebar-provider.svelte` and `ui/sidebar/sidebar-menu-button.svelte`, which the always-visible Rail needs, so extracting the dropdown would remove nothing from the critical path.

**Files:**
- Modify: `web/src/lib/components/critical-path-boundary.test.ts` (the `CRITICAL_PATH_MODULES` map)
- Modify: `web/src/lib/components/shell/Header.svelte` (imports at lines 4 and 22; markup at lines 386-414 and 417-437)

**Interfaces:**
- Consumes: `CRITICAL_PATH_MODULES` from `critical-path-boundary.test.ts` (Task 5).
- Produces: no new exports. The save and overwrite dialogs keep identical props, copy, and behaviour.

- [ ] **Step 1: Write the failing test**

In `web/src/lib/components/critical-path-boundary.test.ts`, extend `CRITICAL_PATH_MODULES` with a second entry so the map reads:

```ts
export const CRITICAL_PATH_MODULES: Record<string, string[]> = {
  '/src/lib/components/LayoutContent.svelte': [
    './shell/ConsoleDrawer.svelte',
    './directory/DirectoryPicker.svelte',
  ],
  '/src/lib/components/shell/Header.svelte': [
    '$lib/components/overlays/ResponsiveDialogDrawer.svelte',
    '../ui/alert-dialog/index.js',
  ],
};
```

- [ ] **Step 2: Run test to verify it fails**

Run from `web/`: `bun run test -- src/lib/components/critical-path-boundary.test.ts`
Expected: FAIL with two violations — `Header.svelte: statically imports $lib/components/overlays/ResponsiveDialogDrawer.svelte` and `... ../ui/alert-dialog/index.js`.

- [ ] **Step 3: Replace the static imports with dynamic ones**

In `web/src/lib/components/shell/Header.svelte`, delete these two lines:

```ts
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
```

```ts
  import * as AlertDialog from '../ui/alert-dialog/index.js';
```

and add, immediately after the two existing state declarations at lines 60-61 (`let showSaveDialog = $state(false);` and `let showOverwriteDialog = $state(false);`):

```ts
  // vaul + the bits-ui dialog machinery are ~100 KB and only ever needed once
  // the user saves a preset.
  let SaveDrawer = $state<typeof import('$lib/components/overlays/ResponsiveDialogDrawer.svelte').default | null>(null);
  let AlertDialog = $state<typeof import('../ui/alert-dialog/index.js') | null>(null);

  $effect(() => {
    if (showSaveDialog && !SaveDrawer) {
      import('$lib/components/overlays/ResponsiveDialogDrawer.svelte').then((module) => {
        SaveDrawer = module.default;
      });
    }
  });

  $effect(() => {
    if (showOverwriteDialog && !AlertDialog) {
      import('../ui/alert-dialog/index.js').then((module) => {
        AlertDialog = module;
      });
    }
  });
```

- [ ] **Step 4: Guard both render sites**

Change the opening and closing tags of the save drawer at lines 386 and 414 from `<ResponsiveDialogDrawer` / `</ResponsiveDialogDrawer>` to `<SaveDrawer` / `</SaveDrawer>`, and wrap the whole element in `{#if SaveDrawer}` … `{/if}`.

Then extend the existing conditional around the overwrite dialog at line 417 so it also waits for the module. Change:

```svelte
  <AlertDialog.Root open={showOverwriteDialog} onOpenChange={(v) => { if (!v && !isOverwritePending) showOverwriteDialog = false; }}>
```

so that the block it sits inside additionally requires `AlertDialog` — i.e. add `{#if AlertDialog}` immediately before that line and a matching `{/if}` immediately after its `</AlertDialog.Root>` at line 437.

- [ ] **Step 5: Confirm vaul left the critical path**

Run from `web/`:

```bash
bun run build
python - <<'PY'
import os, re
html = open('build/index.html').read()
preloaded = [f for f in re.findall(r'href="(/_app/[^"]+)"', html) if os.path.exists('build' + f)]
hits = [f for f in preloaded if b'vaul' in open('build' + f, 'rb').read()]
print("vaul in critical path:", hits or "no")
print(f"critical path: {len(preloaded)} files, {sum(os.path.getsize('build'+f) for f in preloaded)/1024:.0f} KB")
PY
```

Expected: `vaul in critical path: no`.

- [ ] **Step 6: Run the full web suite and e2e**

Run from `web/`: `bun run check && bun run test && bunx playwright test`
Expected: 0 type errors; 61 files, 326 tests passing; all e2e pass. `e2e/phase-a.spec.ts` and `e2e/responsive-workflows.spec.ts` exercise the preset save flow.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/components/shell/Header.svelte web/src/lib/components/critical-path-boundary.test.ts
git commit -m "perf(web): load the header save dialogs on demand"
```

---

### Task 7: Lock the wins in with a budget spec

Without an executable budget, the next component added to the shell silently re-inflates the critical path. This spec is the ratchet.

**Files:**
- Create: `web/e2e/perf-budget.spec.ts`
- Modify: `web/playwright.config.ts` (the `chromium-desktop` project's `testMatch` at lines 21-27)

**Interfaces:**
- Consumes: the built output in `web/build`, served by the existing `tests/webui/e2e_server.py` fixture.
- Produces: no exports.

**Background the implementer needs:**
The e2e fixture server writes no `webui_password`, so `/login` is directly reachable and unauthenticated — `e2e/accessibility.spec.ts` already navigates to it the same way.

- [ ] **Step 1: Write the failing test**

Create `web/e2e/perf-budget.spec.ts`. Leave the two budget constants at the placeholder values below — Step 4 replaces them with the actual measurements, which is why they start at `0` and the spec starts red:

```ts
import { expect, test } from "@playwright/test";

/**
 * These budgets exist because the shadcn-svelte migration silently grew the
 * first-paint bundle from 259 KB to 720 KB, which doubled cold-load LCP.
 * If a change trips these, move the new dependency behind a dynamic import
 * rather than raising the numbers.
 */
const LOGIN_FILE_BUDGET = 0;
const LIVE_BYTE_BUDGET = 0;

test.describe("bundle budgets", () => {
  test("the login page does not download the application shell", async ({ page }) => {
    const appAssets = new Set<string>();
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (path.startsWith("/_app/")) appAssets.add(path);
    });

    await page.goto("/login");
    await page.waitForSelector("input[type=password]");

    console.log(`login /_app/ files: ${appAssets.size}`);
    expect(appAssets.size).toBeLessThanOrEqual(LOGIN_FILE_BUDGET);
  });

  test("hashed assets are cached immutably", async ({ page }) => {
    const cacheHeaders: (string | undefined)[] = [];
    page.on("response", async (response) => {
      const path = new URL(response.url()).pathname;
      if (!path.startsWith("/_app/immutable/") || !path.endsWith(".js")) return;
      cacheHeaders.push((await response.allHeaders())["cache-control"]);
    });

    await page.goto("/live");
    await page.waitForSelector(".main-content");

    expect(cacheHeaders.length).toBeGreaterThan(0);
    expect(cacheHeaders.every((value) => value === "public, max-age=31536000, immutable")).toBe(true);
  });

  test("javascript is served compressed", async ({ page }) => {
    await page.goto("/live");
    await page.waitForSelector(".main-content");

    // transferSize < decodedBodySize is the observable proof of compression:
    // Chromium does not always surface content-encoding to the DevTools protocol,
    // but the size pair is always populated for a fresh (uncached) fetch.
    const scripts = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter((entry) => new URL(entry.name).pathname.startsWith("/_app/immutable/"))
        .filter((entry) => entry.decodedBodySize > 4096 && entry.transferSize > 0)
        .map((entry) => ({ transfer: entry.transferSize, decoded: entry.decodedBodySize }))
    );

    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.every((entry) => entry.transfer < entry.decoded * 0.6)).toBe(true);
  });

  test("the live route stays within its transfer budget", async ({ page }) => {
    await page.goto("/live");
    await page.waitForSelector(".main-content");

    const decoded = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry as PerformanceResourceTiming)
        .filter((entry) => new URL(entry.name).pathname.startsWith("/_app/"))
        .reduce((total, entry) => total + entry.decodedBodySize, 0)
    );

    console.log(`live /_app/ decoded bytes: ${decoded}`);
    expect(decoded).toBeLessThanOrEqual(LIVE_BYTE_BUDGET);
  });
});
```

- [ ] **Step 2: Register the spec with the desktop project**

In `web/playwright.config.ts`, add `perf-budget` to the `chromium-desktop` project's `testMatch` regex, so it reads:

```ts
      testMatch: /phase-a|phase-b|phase-c|console|theme|responsive-workflows|accessibility|visual|paint-states|dialog-width|gallery-viewer|perf-budget/,
```

- [ ] **Step 3: Run the spec to verify it fails and to read the actuals**

Run from `web/`: `bun run build && bunx playwright test perf-budget`
Expected: the two cache/compression tests PASS; the two budget tests FAIL, printing lines like `login /_app/ files: 11` and `live /_app/ decoded bytes: 512345`.

- [ ] **Step 4: Set the budgets from the measurements**

Replace the two placeholder constants with the values just printed, rounded up by roughly 10% of headroom:

```ts
const LOGIN_FILE_BUDGET = 13;          // measured 11
const LIVE_BYTE_BUDGET = 560 * 1024;   // measured ~500 KB
```

Use the numbers your own run printed, not these. Never loosen them later — if a change trips a budget, move the new dependency behind a dynamic import instead.

- [ ] **Step 5: Run the spec again**

Run from `web/`: `bunx playwright test perf-budget`
Expected: 4 passed.

- [ ] **Step 6: Run the whole e2e suite**

Run from `web/`: `bunx playwright test`
Expected: all specs pass.

- [ ] **Step 7: Record the result**

Re-run the measurement table at the top of this plan and note the final numbers in the commit body.

- [ ] **Step 8: Commit**

```bash
git add web/e2e/perf-budget.spec.ts web/playwright.config.ts
git commit -m "test(web): budget the first-paint bundle and asset delivery"
```

---

## Verification

After all seven tasks:

```bash
# Python
python -m pytest tests/webui -q          # expect 202 passed

# Web
cd web
bun run check                            # expect 0 errors
bun run test                             # expect 61 files, 326 tests
bun run build
bunx playwright test                     # expect all green, incl. perf-budget
```

Then confirm the user-visible outcome by hand: start the UI with `./start-web-ui.sh`, open DevTools, throttle to Fast 3G, hard-reload `/`, and check that LCP on the login page is under 1.5 s (baseline 4376 ms) and that a second reload of `/live` issues no `/_app/` network requests at all.
