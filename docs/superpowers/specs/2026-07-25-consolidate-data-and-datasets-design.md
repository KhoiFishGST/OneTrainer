# Consolidate Data & Datasets Routes Design Spec

## Executive Summary

This design specification outlines the consolidation of the **Data** (`/data`) configuration tab and the **Datasets** (`/datasets`) management gallery into a single, unified, intuitive page at `/data`.

The top of `/data` features a compact options panel housing the **Base Directory** path input alongside the 3 data caching toggles (*Aspect Ratio Bucketing*, *Latent Caching*, and *Clear Cache Before Training*). Directly below this panel lies the Dataset Gallery (with dataset creation, thumbnail cards, image/caption counts, and deletion).

---

## 1. User Interface & Layout Architecture

### 1.1 Route Location & Layout Structure (`web/src/routes/data/+page.svelte`)

The page layout consists of three vertical sections:
1. **Page Title**: `Data` (using theme token `color: var(--color-text-title, var(--accent, #3b82f6))`).
2. **Compact Options Panel**:
   - **Row 1**: `Base Directory` path input with browse button (`<PathInput>`).
   - **Row 2**: Horizontal flex container containing 3 compact toggle controls (`<Toggle>` or `<SchemaForm>` field controls):
     - `aspect_ratio_bucketing`: Aspect Ratio Bucketing
     - `latent_caching`: Latent Caching
     - `clear_cache_before_training`: Clear Cache Before Training
3. **Datasets Gallery Grid**:
   - **+ Add Dataset Card**: Triggers modal dialog for creating a dataset (auto-suggested `Dataset {n}` with OS-safe name validation).
   - **Dataset Cards**: Thumbnail overlay with dark gradient, image & caption counts, and hover delete button.

### 1.2 Dataset Detail View (`web/src/routes/datasets/[id]/+page.svelte`)

- Detail sub-route page top header link updated from `"← Back to Datasets"` to **`"← Back to Data"`** navigating back to `/data`.

---

## 2. Navigation Rail & Route Redirection

### 2.1 Side Navigation Rail (`web/src/lib/components/shell/Rail.svelte`)

- Remove `Datasets` from the `navItems` array. `Data` (`/data`) remains as the single data-related item in the rail.

### 2.2 Route Redirection (`web/src/routes/datasets/+page.ts`)

- Delete `web/src/routes/datasets/+page.svelte`.
- Create `web/src/routes/datasets/+page.ts` returning a 307 HTTP redirect to `/data`:
  ```ts
  import { redirect } from '@sveltejs/kit';

  export const load = () => {
    throw redirect(307, '/data');
  };
  ```

---

## 3. Data Flow & State Synchronization

1. **Base Directory Sync**:
   - `baseDir` derives reactively from `ctx?.workspace?.draft?.datasets_dir ?? $datasetsQuery.data?.base_dir ?? 'workspace/datasets'`.
   - Changing `baseDir` calls `ctx.workspace.setRaw('datasets_dir', newPath)`, flushes to `PUT /api/config`, and invalidates `queryKeys.datasets()` so the gallery re-scans instantly.
2. **Data Caching Toggles Sync**:
   - Toggles bind directly to `ctx.workspace.draft.aspect_ratio_bucketing`, `ctx.workspace.draft.latent_caching`, and `ctx.workspace.draft.clear_cache_before_training` via `ctx.workspace.setRaw(path, val)`.

---

## 4. Verification & Testing Strategy

1. **Vitest Unit Tests**:
   - Update `Rail.test.ts` to assert `Data` is present and `Datasets` item is removed from rail.
   - Run complete frontend suite: `cd web && bun run test`.
2. **Pytest Backend Tests**:
   - Run complete backend test suite: `PYTHONPATH=. pytest tests/webui/ -v`.
3. **Production Static Build**:
   - Build frontend bundle: `cd web && bun run build`.
