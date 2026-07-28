<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createConceptsQuery, createUpdateConceptsMutation } from '$lib/api/queries';
  import type { Concept } from '$lib/api/types';
  import ConceptsEditor from '$lib/components/concepts/ConceptsEditor.svelte';
  import { AlertCircle } from 'lucide-svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import { Alert } from '$lib/components/ui/alert';
  import { Skeleton } from '$lib/components/ui/skeleton';

  const conceptsQuery = createConceptsQuery();
  const updateConceptsMutation = createUpdateConceptsMutation();

  let concepts = $state<Concept[]>([]);
  let isInitialized = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if ($conceptsQuery.data && !isInitialized) {
      const data = $conceptsQuery.data;
      concepts = Array.isArray(data) ? data : (data as any)?.concepts || [];
      isInitialized = true;
    }
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  function handleSave(updated: Concept[]) {
    concepts = updated;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      $updateConceptsMutation.mutate(updated);
    }, 1000);
  }

  const errorMessage = $derived(
    $conceptsQuery.error
      ? ($conceptsQuery.error as Error).message || 'Failed to load concepts'
      : $updateConceptsMutation.error
      ? ($updateConceptsMutation.error as Error).message || 'Failed to save concepts'
      : null
  );
</script>

<div class="concepts-page">
  <PageHeader title="Concepts" />

  {#if errorMessage}
    <Alert variant="destructive" class="concepts-error-alert">
      <AlertCircle size={18} />
      <span>{errorMessage}</span>
    </Alert>
  {/if}

  {#if $conceptsQuery.isLoading}
    <div role="status" aria-label="Loading concepts" class="skeleton-container">
      <Skeleton class="h-[140px] w-full" />
      <Skeleton class="h-[140px] w-full" />
    </div>
  {:else}
    <ConceptsEditor
      {concepts}
      disabled={false}
      onChange={handleSave}
    />
  {/if}
</div>

<style>
  .concepts-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 1200px;
    width: 100%;
    box-sizing: border-box;
  }

  .concepts-page :global(.concepts-error-alert) {
    display: flex;
    align-items: center;
    gap: 0.625rem;
  }

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>
