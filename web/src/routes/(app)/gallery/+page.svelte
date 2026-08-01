<script lang="ts">
  import {
    createGalleryRunsQuery,
    createGalleryCurrentQuery,
    createGalleryRunQuery,
  } from '$lib/api/queries';
  import type { GalleryRunModel } from '$lib/api/types';
  import SampleGallery from '$lib/components/training/SampleGallery.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import { Button } from '$lib/components/ui/button';
  import { tryGetRouteContext } from '$lib/config/context';
  import { api } from '$lib/api/client';
  import { toast } from 'svelte-sonner';

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

  const routeCtx = tryGetRouteContext();
  const workspace = $derived(routeCtx?.workspace ?? null);

  let isLoadingRun = $state(false);

  const selectedRunSummary = $derived(
    availableRuns.find((r) => r.key === selectedRunKey) ?? null
  );

  const canLoadRun = $derived(
    Boolean(workspace) &&
      Boolean(selectedRunKey) &&
      Boolean(selectedRunSummary?.config_filename) &&
      !isLoadingRun
  );

  async function performLoadRun() {
    const key = selectedRunKey;
    if (!key || !workspace) return;

    isLoadingRun = true;
    try {
      const resp = await api.loadGalleryRunConfig(key, workspace.revision);
      workspace.acceptRemote(resp);
      toast.success(`Loaded config from run ${key}`);
    } catch (err: any) {
      const detail = err?.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Could not load the config for this run';
      toast.error(message);
    } finally {
      isLoadingRun = false;
    }
  }

  async function handleLoadRun() {
    if (!canLoadRun) return;
    await performLoadRun();
  }

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

<RoutePage>
  <div class="contents" data-testid="gallery-page">
    <PageHeader title="Sample Gallery">
      {#snippet actions()}
        <label for="gallery-run-select" class="text-sm font-medium text-muted-foreground">Run</label>
        <Select
          id="gallery-run-select"
          ariaLabel="Run"
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
        <Button
          variant="secondary"
          disabled={!canLoadRun}
          onclick={handleLoadRun}
        >
          {isLoadingRun ? 'Loading...' : 'Load Run'}
        </Button>
      {/snippet}
    </PageHeader>

    <section class="w-full">
      <SampleGallery
        gallery={displayGallery}
        loading={displayLoading}
        error={displayError}
        title="Sample Gallery"
      />
    </section>
  </div>
</RoutePage>

