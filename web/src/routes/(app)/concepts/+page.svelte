<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createConceptsQuery, createUpdateConceptsMutation } from '$lib/api/queries';
  import type { Concept } from '$lib/api/types';
  import ConceptsEditor from '$lib/components/concepts/ConceptsEditor.svelte';
  import { AlertCircle } from '@lucide/svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
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

  let pendingResolvers: Array<{ resolve: () => void; reject: (err: any) => void }> = [];

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  let saveError = $state<string | null>(null);

  function handleSave(updated: Concept[]): Promise<void> {
    concepts = updated;
    saveError = null;
    if (debounceTimer) clearTimeout(debounceTimer);

    return new Promise((resolve, reject) => {
      pendingResolvers.push({ resolve, reject });

      debounceTimer = setTimeout(async () => {
        const resolversToNotify = [...pendingResolvers];
        pendingResolvers = [];
        try {
          await $updateConceptsMutation.mutateAsync(updated);
          saveError = null;
          resolversToNotify.forEach((r) => r.resolve());
        } catch (err: any) {
          saveError = err?.message || 'Failed to save concepts';
          resolversToNotify.forEach((r) => r.reject(err));
        }
      }, 1000);
    });
  }

  const errorMessage = $derived(
    $conceptsQuery.error
      ? ($conceptsQuery.error as Error).message || 'Failed to load concepts'
      : saveError || ($updateConceptsMutation.error ? ($updateConceptsMutation.error as Error).message || 'Failed to save concepts' : null)
  );
</script>

<RoutePage class="gap-5">
  <PageHeader title="Concepts" />

  {#if errorMessage}
    <Alert variant="destructive" class="concepts-error-alert flex items-center gap-2.5">
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
</RoutePage>

<style>
  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
</style>

