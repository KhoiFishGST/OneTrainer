<script lang="ts">
  import { onDestroy } from 'svelte';
  import { createConceptsQuery, createUpdateConceptsMutation } from '$lib/api/queries';
  import type { Concept } from '$lib/api/types';
  import ConceptsEditor from '$lib/components/concepts/ConceptsEditor.svelte';
  import { Save, Check, AlertCircle, RefreshCw } from 'lucide-svelte';

  const conceptsQuery = createConceptsQuery();
  const updateConceptsMutation = createUpdateConceptsMutation();

  let concepts = $state<Concept[]>([]);
  let isInitialized = $state(false);
  let saveSuccess = $state(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let saveSuccessTimer: ReturnType<typeof setTimeout> | null = null;

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
    $updateConceptsMutation.mutate(listToSave, {
      onSuccess: () => {
        saveSuccess = true;
        if (saveSuccessTimer) clearTimeout(saveSuccessTimer);
        saveSuccessTimer = setTimeout(() => {
          saveSuccess = false;
        }, 3000);
      },
    });
  }

  function handleConceptsChange(newConcepts: Concept[]) {
    concepts = newConcepts;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      performSave(newConcepts);
    }, 1000);
  }

  function handleSaveClick() {
    performSave(concepts);
  }

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (saveSuccessTimer) clearTimeout(saveSuccessTimer);
  });

  const errorMessage = $derived(
    ($conceptsQuery.error as Error)?.message ||
      ($updateConceptsMutation.error as Error)?.message ||
      null
  );
</script>

<div class="concepts-page">
  <div class="page-header">
    <div>
      <h1 class="page-title">Concepts</h1>
      <p class="page-subtitle">Manage dataset concepts, prompts, and directories for training.</p>
    </div>

    <div class="header-actions">
      {#if saveSuccess}
        <span class="status-indicator success">
          <Check size={16} />
          Saved
        </span>
      {/if}
      <button
        type="button"
        class="btn btn-primary"
        disabled={$conceptsQuery.isLoading || $updateConceptsMutation.isPending}
        onclick={handleSaveClick}
      >
        {#if $updateConceptsMutation.isPending}
          <span class="spinning"><RefreshCw size={16} /></span>
          <span>Saving...</span>
        {:else}
          <Save size={16} />
          <span>Save Changes</span>
        {/if}
      </button>
    </div>
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
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #dd773b));
  }

  .page-subtitle {
    font-size: 0.875rem;
    color: var(--muted, #6b7280);
    margin: 0;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-indicator {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-indicator.success {
    color: #16a34a;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5625rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
  }

  .btn-primary {
    background: var(--accent, #2563eb);
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .spinning {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
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
