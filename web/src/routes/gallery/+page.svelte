<script lang="ts">
  import {
    createGalleryRunsQuery,
    createGalleryCurrentQuery,
    createGalleryRunQuery,
  } from '$lib/api/queries';
  import type { GalleryRunModel } from '$lib/api/types';
  import SampleGallery from '$lib/components/training/SampleGallery.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';

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

  let runQueryState = $state<{ data?: GalleryRunModel | null; isLoading?: boolean; error?: Error | null }>({});

  $effect(() => {
    const unsubscribe = runQuery.subscribe((state) => {
      runQueryState = state;
    });
    return unsubscribe;
  });

  const displayGallery = $derived.by(() => {
    if (selectedRunKey && selectedRunKey !== activeKey) {
      return runQueryState.data ?? null;
    }
    return $currentQuery.data ?? null;
  });

  const displayLoading = $derived.by(() => {
    if (selectedRunKey && selectedRunKey !== activeKey) {
      return runQueryState.isLoading ?? false;
    }
    return $currentQuery.isLoading;
  });

  const displayError = $derived.by(() => {
    if (selectedRunKey && selectedRunKey !== activeKey) {
      return runQueryState.error ?? null;
    }
    return $currentQuery.error;
  });
</script>

<div class="gallery-page" data-testid="gallery-page">
  <PageHeader title="Sample Gallery" class="gallery-header">
    {#snippet actions()}
      <label for="gallery-run-select" class="select-label">Gallery run</label>
      <Select
        id="gallery-run-select"
        ariaLabel="Gallery run"
        bind:value={userSelectedKey}
        options={availableRuns.map((r) => ({
          value: r.key,
          label: `${r.key}${r.active ? ' (Active)' : ''}`,
        }))}
        placeholder={availableRuns.length === 0 ? 'No runs available' : 'Select run...'}
        disabled={availableRuns.length === 0}
        onChange={(val) => {
          userSelectedKey = val || null;
        }}
      />
    {/snippet}
  </PageHeader>

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

  .gallery-page :global(.gallery-header) {
    margin-bottom: 0.5rem;
  }

  .select-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--muted, #94a3b8);
  }

  .gallery-content {
    width: 100%;
  }
</style>
