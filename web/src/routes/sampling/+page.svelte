<script lang="ts">
  import { onMount } from 'svelte';
  import { Sparkles, Pencil, Copy, Trash2 } from 'lucide-svelte';
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import AddCard from '$lib/components/ui/AddCard.svelte';
  import SampleDetailModal from '$lib/components/sampling/SampleDetailModal.svelte';
  import { trainingStore } from '$lib/events/training-store';
  import { api } from '$lib/api/client';
  import {
    createRequestSampleMutation,
    createSamplesQuery,
    createUpdateSamplesMutation,
  } from '$lib/api/queries';

  const ctx = getRouteContext();
  const sampleMutation = createRequestSampleMutation();
  const samplesQuery = createSamplesQuery();
  const updateSamplesMutation = createUpdateSamplesMutation();

  const samples = $derived($samplesQuery.data ?? []);

  let isModalOpen = $state(false);
  let editingSample = $state<any>(null);
  let editingIndex = $state<number>(-1);
  let modalMode = $state<'add' | 'edit'>('add');

  let toast = $state<{ message: string; type: 'success' | 'error' } | null>(null);
  let toastTimeout: any;

  function triggerToast(message: string, type: 'success' | 'error' = 'success') {
    if (toastTimeout) clearTimeout(toastTimeout);
    toast = { message, type };
    toastTimeout = setTimeout(() => {
      toast = null;
    }, 4000);
  }

  onMount(async () => {
    try {
      const statusData = await api.getTrainingStatus();
      if (statusData) trainingStore.setStatus(statusData);
    } catch {
      // ignore
    }
  });

  const status = $derived($trainingStore.status);
  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'sampling') ?? {
      id: 'sampling',
      label: 'Sampling',
      groups: [],
    }
  );

  async function handleSample() {
    try {
      await $sampleMutation.mutateAsync();
      triggerToast('Sample generation requested successfully', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to request sample', 'error');
    }
  }

  function handleAddSample() {
    editingSample = null;
    editingIndex = -1;
    modalMode = 'add';
    isModalOpen = true;
  }

  function handleEditSample(index: number) {
    editingSample = samples[index];
    editingIndex = index;
    modalMode = 'edit';
    isModalOpen = true;
  }

  async function handleToggleSample(index: number, event: Event) {
    event.stopPropagation();
    const updated = samples.map((s: any, i: number) =>
      i === index ? { ...s, enabled: !s.enabled } : s
    );
    try {
      await $updateSamplesMutation.mutateAsync(updated);
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to update sample', 'error');
    }
  }

  async function handleCloneSample(index: number, event: Event) {
    event.stopPropagation();
    const target = samples[index];
    const cloned = { ...target };
    const updated = [...samples, cloned];
    try {
      await $updateSamplesMutation.mutateAsync(updated);
      triggerToast('Sample cloned', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to clone sample', 'error');
    }
  }

  async function handleDeleteSample(index: number, event: Event) {
    event.stopPropagation();
    const updated = samples.filter((_: any, i: number) => i !== index);
    try {
      await $updateSamplesMutation.mutateAsync(updated);
      triggerToast('Sample deleted', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to delete sample', 'error');
    }
  }

  async function handleSaveSample(savedSample: any) {
    let updated: any[];
    if (modalMode === 'add' || editingIndex === -1) {
      updated = [...samples, savedSample];
    } else {
      updated = samples.map((s: any, i: number) => (i === editingIndex ? savedSample : s));
    }
    isModalOpen = false;
    try {
      await $updateSamplesMutation.mutateAsync(updated);
      triggerToast(modalMode === 'add' ? 'Sample prompt added' : 'Sample prompt saved', 'success');
    } catch (err: any) {
      triggerToast(err?.message || 'Failed to save sample', 'error');
    }
  }
</script>

{#if !ctx.workspace}
  <div class="skeleton-container" aria-label="Loading configuration">
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  </div>
{:else}
  <div class="route-page">
    <div class="page-header">
      <h1 class="page-title">{tab.label || 'Sampling'}</h1>
      <div class="header-actions">
        <button
          type="button"
          class="btn btn-secondary"
          disabled={status.state !== 'RUNNING' && status.state !== 'TRAINING' || $sampleMutation.isPending}
          onclick={handleSample}
          title={status.state === 'RUNNING' || status.state === 'TRAINING' ? 'Trigger immediate sample image generation' : 'Active training run required to sample now'}
        >
          <Sparkles size={16} />
          <span>Sample Now</span>
        </button>
      </div>
    </div>

    {#if toast}
      <div class="toast-banner {toast.type} toast-{toast.type}" role="status">
        {toast.message}
      </div>
    {/if}

    <div class="options-panel">
      <SchemaForm
        {tab}
        values={ctx.workspace.draft}
        issues={ctx.workspace.errors}
        setRaw={(path, val) => ctx.workspace?.setRaw(path, val)}
        openDirectory={ctx.openDirectory}
      />
    </div>

    <div class="section-divider">
      <h2 class="section-title">Sample Prompts ({samples.length})</h2>
    </div>

    <div class="samples-grid">
      <AddCard label="Add Sample Prompt" onClick={handleAddSample} />

      {#each samples as sample, index}
        <div
          class="sample-card"
          class:disabled={!sample.enabled}
          onclick={() => handleEditSample(index)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleEditSample(index);
            }
          }}
          role="button"
          tabindex="0"
        >
          <div class="card-header">
            <div class="switch-wrapper" onclick={(e) => e.stopPropagation()} role="none">
              <label class="switch">
                <input
                  type="checkbox"
                  checked={sample.enabled}
                  onchange={(e) => handleToggleSample(index, e)}
                />
                <span class="slider"></span>
              </label>
            </div>
            <div class="card-actions">
              <button
                type="button"
                class="icon-btn"
                title="Edit sample prompt"
                onclick={(e) => {
                  e.stopPropagation();
                  handleEditSample(index);
                }}
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                class="icon-btn"
                title="Clone sample prompt"
                onclick={(e) => handleCloneSample(index, e)}
              >
                <Copy size={15} />
              </button>
              <button
                type="button"
                class="icon-btn danger"
                title="Delete sample prompt"
                onclick={(e) => handleDeleteSample(index, e)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          <div class="card-body">
            <div class="prompt-text">{sample.prompt || '(No prompt set)'}</div>
            {#if sample.negative_prompt}
              <div class="negative-prompt-text">
                <span class="neg-label">Neg:</span> {sample.negative_prompt}
              </div>
            {/if}
          </div>

          <div class="card-footer">
            <div class="pills">
              <span class="pill">{sample.width || 512} × {sample.height || 512}</span>
              <span class="pill">{sample.diffusion_steps || 30} steps</span>
              <span class="pill">CFG {sample.cfg_scale ?? 7.5}</span>
              <span class="pill">Seed: {sample.seed ?? -1}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<SampleDetailModal
  open={isModalOpen}
  sample={editingSample}
  mode={modalMode}
  onSave={handleSaveSample}
  onClose={() => (isModalOpen = false)}
/>

<style>
  .route-page {
    padding: 1.5rem;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
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
    gap: 0.5rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.85rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: var(--panel-raised, var(--control, #14191f));
    color: var(--text, #e6ebef);
    border-color: var(--line, #2d3741);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--line, #2d3741);
  }

  .toast-banner {
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }

  .toast-banner.success,
  .toast-success {
    background-color: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .toast-banner.error,
  .toast-error {
    background-color: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }

  .options-panel {
    max-width: 740px;
    margin: 0 auto 2rem;
  }

  .section-divider {
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--line, #2d3741);
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    color: var(--text, #f8fafc);
  }

  .samples-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.25rem;
    align-items: stretch;
  }

  .sample-card {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 220px;
    background: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    padding: 1rem;
    cursor: pointer;
    transition: all 0.15s ease;
    box-sizing: border-box;
  }

  .sample-card:hover {
    border-color: var(--accent, #3b82f6);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .sample-card.disabled {
    opacity: 0.6;
    background: rgba(29, 36, 44, 0.5);
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .card-actions {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--muted, #94a3b8);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .icon-btn:hover {
    background: var(--line, #2d3741);
    color: var(--text, #f8fafc);
  }

  .icon-btn.danger:hover {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .card-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .prompt-text {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text, #f8fafc);
    line-height: 1.4;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .negative-prompt-text {
    font-size: 0.75rem;
    color: var(--muted, #94a3b8);
    line-height: 1.3;
    word-break: break-word;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .neg-label {
    font-weight: 600;
    color: #f87171;
  }

  .card-footer {
    margin-top: auto;
  }

  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    color: var(--muted, #94a3b8);
  }

  /* Toggle Switch */
  .switch {
    position: relative;
    display: inline-block;
    width: 36px;
    height: 20px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: var(--line, #2d3741);
    transition: 0.2s;
    border-radius: 20px;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 14px;
    width: 14px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.2s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background-color: var(--accent, #3b82f6);
  }

  input:checked + .slider:before {
    transform: translateX(16px);
  }

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }

  .skeleton-row {
    height: 3rem;
    background: var(--color-skeleton, #e5e7eb);
    border-radius: 6px;
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
