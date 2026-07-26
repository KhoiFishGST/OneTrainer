<script lang="ts">
  import {
    createGalleryRunsQuery,
    createGalleryCurrentQuery,
    createGalleryRunQuery,
  } from '$lib/api/queries';
  import SampleGallery from '$lib/components/training/SampleGallery.svelte';

  const runsQuery = createGalleryRunsQuery();
  const currentQuery = createGalleryCurrentQuery();

  let userSelectedKey = $state<string | null>(null);

  const activeKey = $derived($currentQuery.data?.run?.key || null);

  const availableRuns = $derived.by(() => {
    const summaries = [...($runsQuery.data?.runs || [])];
    if (activeKey) {
      if (!summaries.some((r) => r.key === activeKey)) {
        summaries.push({
          key: activeKey,
          config_filename: $currentQuery.data?.run?.config_filename || 'config.json',
          started_at: $currentQuery.data?.run?.started_at || '',
          batch_count: $currentQuery.data?.batches?.length || 0,
          active: $currentQuery.data?.active ?? true,
        });
      }
    }
    summaries.sort((a, b) => {
      const timeA = a.started_at || a.key;
      const timeB = b.started_at || b.key;
      return timeB.localeCompare(timeA);
    });
    return summaries;
  });

  const selectedRunKey = $derived.by(() => {
    if (userSelectedKey) {
      const isValid =
        (activeKey && userSelectedKey === activeKey) ||
        availableRuns.some((r) => r.key === userSelectedKey);
      if (isValid) return userSelectedKey;
    }
    if (activeKey) return activeKey;
    if (availableRuns.length > 0) return availableRuns[0].key;
    return null;
  });

  const runQuery = $derived(createGalleryRunQuery(selectedRunKey));

  const displayGallery = $derived.by(() => {
    if (selectedRunKey && selectedRunKey !== activeKey) {
      return $runQuery?.data ?? null;
    }
    return $currentQuery.data ?? null;
  });

  const displayLoading = $derived.by(() => {
    if (selectedRunKey && selectedRunKey !== activeKey) {
      return $runQuery?.isLoading ?? false;
    }
    return $currentQuery.isLoading;
  });

  const displayError = $derived.by(() => {
    if (selectedRunKey && selectedRunKey !== activeKey) {
      return $runQuery?.error ?? null;
    }
    return $currentQuery.error;
  });
</script>

<div class="gallery-page" data-testid="gallery-page">
  <div class="page-header">
    <div class="header-title-group">
      <h1 class="page-title">Sample Gallery</h1>
    </div>

    <div class="header-actions">
      <label for="gallery-run-select" class="select-label">Gallery run</label>
      <select
        id="gallery-run-select"
        aria-label="Gallery run"
        class="run-select"
        value={selectedRunKey ?? ''}
        onchange={(e) => {
          userSelectedKey = (e.target as HTMLSelectElement).value || null;
        }}
      >
        {#if availableRuns.length === 0}
          <option value="" disabled>No runs available</option>
        {:else}
          {#each availableRuns as run (run.key)}
            <option value={run.key}>{run.key}{run.active ? ' (Active)' : ''}</option>
          {/each}
        {/if}
      </select>
    </div>
  </div>

  <section class="gallery-content">
    <SampleGallery
      gallery={displayGallery}
      loading={displayLoading}
      error={displayError}
      title="Sample Gallery"
    />
  </section>
</div>

<style>
  .gallery-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 1600px;
    width: 100%;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .select-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted, #94a3b8);
  }

  .run-select {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    padding: 0.4rem 0.85rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    outline: none;
  }

  .run-select:focus {
    border-color: var(--accent, #3b82f6);
  }

  .gallery-content {
    width: 100%;
  }
</style>
