<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createConceptsQuery, createUpdateConceptsMutation } from '$lib/api/queries';
  import type { Concept } from '$lib/api/types';
  import ConceptsEditor from '$lib/components/concepts/ConceptsEditor.svelte';
  import { AlertCircle } from 'lucide-svelte';

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

  function performSave(listToSave: Concept[]) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    $updateConceptsMutation.mutate(listToSave);
  }

  function handleConceptsChange(newConcepts: Concept[]) {
    concepts = newConcepts;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSave(newConcepts);
    }, 1000);
  }

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  const errorMessage = $derived(
    ($conceptsQuery.error as Error)?.message ||
      ($updateConceptsMutation.error as Error)?.message ||
      null
  );
</script>

<div class="concepts-page">
  <div class="page-header">
    <h1 class="page-title">Concepts</h1>
  </div>

  {#if errorMessage}
    <div class="alert alert-error">
      <AlertCircle size={18} />
      <span>{errorMessage}</span>
    </div>
  {/if}

  {#if $conceptsQuery.isLoading}
    <div class="skeleton-container" aria-label="Loading concepts">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  {:else}
    <ConceptsEditor
      {concepts}
      disabled={false}
      onChange={handleConceptsChange}
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

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .alert-error {
    background: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .skeleton-card {
    height: 140px;
    background: var(--panel-raised, #e5e7eb);
    border-radius: 8px;
    animation: pulse 1.5s infinite ease-in-out;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
