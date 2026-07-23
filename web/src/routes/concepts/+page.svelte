<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '$lib/api/client';
  import type { Concept } from '$lib/api/types';
  import ConceptsEditor from '$lib/components/concepts/ConceptsEditor.svelte';
  import { Save, Check, AlertCircle, RefreshCw } from 'lucide-svelte';

  let concepts = $state<Concept[]>([]);
  let loading = $state(true);
  let saving = $state(false);
  let saveSuccess = $state(false);
  let errorMessage = $state<string | null>(null);

  onMount(async () => {
    await fetchConcepts();
  });

  async function fetchConcepts() {
    loading = true;
    errorMessage = null;
    try {
      const data = await api.getConcepts();
      concepts = Array.isArray(data) ? data : (data as any)?.concepts || [];
    } catch (err: any) {
      errorMessage = err.message || 'Failed to load concepts';
    } finally {
      loading = false;
    }
  }

  async function saveConcepts(updatedConcepts?: Concept[]) {
    const listToSave = updatedConcepts ?? concepts;
    saving = true;
    errorMessage = null;
    saveSuccess = false;
    try {
      const res = await api.putConcepts(listToSave);
      concepts = res.concepts || listToSave;
      saveSuccess = true;
      setTimeout(() => {
        saveSuccess = false;
      }, 3000);
    } catch (err: any) {
      errorMessage = err.message || 'Failed to save concepts';
    } finally {
      saving = false;
    }
  }

  function handleConceptsChange(newConcepts: Concept[]) {
    concepts = newConcepts;
    saveConcepts(newConcepts);
  }
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
        disabled={loading || saving}
        onclick={() => saveConcepts()}
      >
        {#if saving}
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

  {#if loading}
    <div class="skeleton-container" aria-label="Loading concepts">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  {:else}
    <ConceptsEditor
      {concepts}
      disabled={saving}
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
    margin: 0 0 0.25rem 0;
    color: var(--text, #111827);
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
