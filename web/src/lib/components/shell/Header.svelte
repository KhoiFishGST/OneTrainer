<script lang="ts">
  import Select from '../form/Select.svelte';
  import ModalDialog from '../ui/ModalDialog.svelte';
  import {
    createMetaQuery,
    createPresetsQuery,
    createLoadPresetMutation,
    createSavePresetMutation,
  } from '../../api/queries';
  import { getRouteContext } from '../../config/context';
  import type { ConfigWorkspace } from '../../config/workspace.svelte';
  import { trainingStore } from '../../events/training-store';
  import { api } from '../../api/client';

  let {
    workspace: workspaceProp = null,
    metaData: metaDataProp = null,
    presetsData: presetsDataProp = null,
  } = $props<{
    workspace?: ConfigWorkspace | null;
    metaData?: any;
    presetsData?: any;
  }>();

  let ctx: any = null;
  try {
    ctx = getRouteContext();
  } catch {
    // context not provided in isolated unit test
  }

  const metaQuery = createMetaQuery();
  const presetsQuery = createPresetsQuery();
  const loadPresetMutation = createLoadPresetMutation();
  const savePresetMutation = createSavePresetMutation();

  const workspace = $derived(workspaceProp ?? ctx?.workspace);
  const meta = $derived(metaDataProp ?? $metaQuery.data);
  const presets = $derived(presetsDataProp ?? $presetsQuery.data);

  let showSaveDialog = $state(false);
  let presetName = $state('');
  let saveError = $state<string | null>(null);

  const modelTypes = $derived(meta?.model_types ?? []);

  const currentModelType = $derived(
    workspace?.draft?.model_type ?? modelTypes[0]?.value ?? ''
  );

  const selectedModelTypeObj = $derived(
    modelTypes.find((m: any) => m.value === currentModelType) ?? modelTypes[0]
  );

  const trainingMethods = $derived(
    selectedModelTypeObj?.training_methods ?? []
  );

  const currentTrainingMethod = $derived(
    workspace?.draft?.training_method ?? trainingMethods[0]?.value ?? ''
  );

  function handleModelTypeChange(newType: string) {
    if (!workspace) return;

    const mtObj = modelTypes.find((m: any) => m.value === newType);
    const validMethods = mtObj?.training_methods?.map((tm: any) => tm.value) ?? [];
    const curMethod = workspace.draft?.training_method;

    if (validMethods.length > 0 && !validMethods.includes(curMethod)) {
      workspace.setRaw('training_method', validMethods[0]);
    }
    workspace.setRaw('model_type', newType);
  }

  function handleTrainingMethodChange(newMethod: string) {
    if (!workspace) return;
    workspace.setRaw('training_method', newMethod);
  }

  function flattenPresetTree(nodes: any[], prefix = ''): { id: string; label: string }[] {
    if (!Array.isArray(nodes)) return [];
    let result: { id: string; label: string }[] = [];
    for (const node of nodes) {
      if (node.children) {
        result = result.concat(flattenPresetTree(node.children, prefix ? `${prefix} / ${node.label}` : node.label));
      } else if (node.id) {
        result.push({ id: node.id, label: prefix ? `${prefix} / ${node.label}` : node.label });
      }
    }
    return result;
  }

  const flattenedPresets = $derived(flattenPresetTree(presets ?? []));

  async function handleSelectPreset(presetId: string) {
    if (!presetId || !workspace) return;

    try {
      await $loadPresetMutation.mutateAsync({
        preset_id: presetId,
        base_revision: workspace.revision,
        overwrite: false,
      });
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if (status === 409) {
        workspace.conflictRevision = err?.detail?.current_revision ?? null;
        workspace.state = 'conflict';
      }
    }
  }

  async function openSavePresetModal() {
    saveError = null;
    if (workspace) {
      try {
        await workspace.beforePresetSave();
      } catch (err: any) {
        saveError = err?.message ?? 'Cannot save preset';
        return;
      }
    }
    showSaveDialog = true;
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    try {
      await $savePresetMutation.mutateAsync({ name: presetName.trim() });
      showSaveDialog = false;
      presetName = '';
      saveError = null;
    } catch (err: any) {
      saveError = err?.message ?? 'Failed to save preset';
    }
  }

  const trainingState = $derived($trainingStore.status?.state ?? 'IDLE');

  async function handleStartTraining() {
    try {
      await api.startTraining();
    } catch (err) {
      console.error('Failed to start training', err);
    }
  }

  async function handlePauseTraining() {
    try {
      await api.pauseTraining();
    } catch (err) {
      console.error('Failed to pause training', err);
    }
  }

  async function handleResumeTraining() {
    try {
      await api.resumeTraining();
    } catch (err) {
      console.error('Failed to resume training', err);
    }
  }

  async function handleStopTraining() {
    try {
      await api.stopTraining();
    } catch (err) {
      console.error('Failed to stop training', err);
    }
  }

  async function handleSample() {
    try {
      await api.requestSample();
    } catch (err) {
      console.error('Failed to request sample', err);
    }
  }

  async function handleBackup() {
    try {
      await api.requestBackup();
    } catch (err) {
      console.error('Failed to request backup', err);
    }
  }
</script>

<header class="header">
  <div class="brand">
    <img src="/logo.png" alt="OneTrainer Logo" class="brand-logo" />
    <span class="app-title">OneTrainer</span>
  </div>

  <div class="selectors">
    <div class="selector-field">
      <span class="label-text">Model</span>
      <div class="header-select-wrapper">
        <Select
          ariaLabel="Model Type"
          value={currentModelType}
          options={modelTypes}
          onChange={handleModelTypeChange}
        />
      </div>
    </div>

    <div class="selector-field">
      <span class="label-text">Method</span>
      <div class="header-select-wrapper">
        <Select
          ariaLabel="Training Method"
          value={currentTrainingMethod}
          options={trainingMethods}
          onChange={handleTrainingMethodChange}
        />
      </div>
    </div>

    <div class="selector-field">
      <span class="label-text">Preset</span>
      <div class="header-select-wrapper">
        <Select
          ariaLabel="Presets"
          value=""
          placeholder="Select preset..."
          options={flattenedPresets.map((p) => ({ value: p.id, label: p.label }))}
          onChange={handleSelectPreset}
        />
      </div>
    </div>

    <button
      type="button"
      class="btn btn-secondary"
      onclick={openSavePresetModal}
    >
      Save Preset
    </button>
  </div>

  <div class="training-bar">
    <span
      data-testid="training-status-pill"
      class="status-pill status-{trainingState.toLowerCase()}"
      title={$trainingStore.status?.error_message ?? ''}
    >
      {trainingState}
    </span>

    {#if trainingState === 'IDLE' || trainingState === 'COMPLETED' || trainingState === 'FAILED'}
      <button
        type="button"
        class="btn btn-primary"
        onclick={handleStartTraining}
      >
        Start Training
      </button>
    {:else if trainingState === 'TRAINING'}
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handlePauseTraining}
      >
        Pause
      </button>
      <button
        type="button"
        class="btn btn-danger"
        onclick={handleStopTraining}
      >
        Stop
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handleSample}
      >
        Sample
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handleBackup}
      >
        Backup
      </button>
    {:else if trainingState === 'PAUSED'}
      <button
        type="button"
        class="btn btn-primary"
        onclick={handleResumeTraining}
      >
        Resume
      </button>
      <button
        type="button"
        class="btn btn-danger"
        onclick={handleStopTraining}
      >
        Stop
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handleSample}
      >
        Sample
      </button>
      <button
        type="button"
        class="btn btn-secondary"
        onclick={handleBackup}
      >
        Backup
      </button>
    {:else if trainingState === 'STOPPING'}
      <button
        type="button"
        class="btn btn-danger"
        disabled
      >
        Stop
      </button>
    {/if}
  </div>

  <div class="actions">
    {#if workspace}
      <span class="state-badge state-{workspace.state}">
        {#if workspace.state === 'saved'}
          Saved
        {:else if workspace.state === 'unsaved'}
          Unsaved
        {:else if workspace.state === 'saving'}
          Saving...
        {:else if workspace.state === 'conflict'}
          Conflict
        {:else if workspace.state === 'failed'}
          Failed
        {/if}
      </span>

      {#if workspace.state === 'failed' || workspace.state === 'unsaved'}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => workspace.retry()}
        >
          Retry
        </button>
      {/if}

      {#if workspace.state === 'conflict'}
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => workspace.reloadServer(true)}
        >
          Reload
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={() => workspace.overwriteServer()}
        >
          Overwrite
        </button>
      {/if}
    {/if}
  </div>
</header>

{#if saveError && !showSaveDialog}
  <div class="save-error-toast" role="alert">
    {saveError}
  </div>
{/if}

{#if trainingState === 'FAILED' && $trainingStore.status?.error_message}
  <div class="save-error-toast" role="alert">
    {$trainingStore.status.error_message}
  </div>
{/if}

<ModalDialog
  open={showSaveDialog}
  title="Save Preset"
  applyText="Save"
  cancelText="Cancel"
  onClose={() => (showSaveDialog = false)}
  onApply={handleSavePreset}
>
  {#if saveError}
    <p class="error-msg">{saveError}</p>
  {/if}
  <label class="modal-field">
    <span>Preset Name</span>
    <input
      type="text"
      aria-label="Preset Name"
      bind:value={presetName}
      placeholder="My Custom Preset"
    />
  </label>
</ModalDialog>

<style>
  .header {
    height: 56px;
    background-color: var(--panel);
    border-bottom: 1px solid var(--line);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    gap: 16px;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 1.125rem;
    color: var(--accent);
  }

  .brand-logo {
    width: 26px;
    height: 26px;
    object-fit: contain;
    border-radius: 4px;
  }

  .selectors {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .selector-field {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.875rem;
  }

  .label-text {
    color: var(--muted);
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .state-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .state-saved {
    background-color: rgba(101, 185, 141, 0.15);
    color: var(--success);
  }

  .state-unsaved {
    background-color: rgba(59, 130, 246, 0.15);
    color: var(--accent);
  }

  .state-saving {
    background-color: rgba(137, 149, 161, 0.15);
    color: var(--muted);
  }

  .state-conflict,
  .state-failed {
    background-color: rgba(217, 120, 120, 0.15);
    color: var(--danger);
  }

  .btn {
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.875rem;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .btn-primary {
    background-color: var(--accent);
    color: #fff;
  }

  .btn-secondary {
    background-color: var(--control);
    color: var(--text);
    border-color: var(--line);
  }

  .btn-danger {
    background-color: var(--danger);
    color: #fff;
  }

  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.6);
    z-index: 200;
  }

  .modal-content {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--panel);
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 24px;
    width: 360px;
    max-width: 90vw;
    z-index: 201;
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 16px 0;
  }

  input[type='text'] {
    background-color: var(--control);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 8px 12px;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .error-msg,
  .save-error-toast {
    color: var(--danger);
    font-size: 0.875rem;
  }

  .training-bar {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-pill {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-idle {
    background-color: var(--panel-raised, rgba(255, 255, 255, 0.05));
    color: var(--muted, #888);
    border: 1px solid var(--line, #444);
  }

  .status-starting,
  .status-training {
    background-color: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-paused {
    background-color: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-stopping {
    background-color: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .status-completed {
    background-color: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-failed {
    background-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .custom-dropdown-container {
    position: relative;
    display: inline-flex;
    align-items: center;
  }

  .dropdown-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background-color: var(--control);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 0.875rem;
    cursor: pointer;
    min-width: 140px;
    white-space: nowrap;
    transition: border-color 0.15s ease;
  }

  .dropdown-trigger:hover {
    border-color: var(--accent);
  }

  .dropdown-popover {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 100%;
    width: max-content;
    max-width: 320px;
    max-height: 280px;
    overflow-y: auto;
    background-color: var(--panel-raised, #1d242c);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 250;
    display: flex;
    flex-direction: column;
    padding: 4px;
    gap: 2px;
    animation: fadeIn 0.12s ease-out;
  }

  .popover-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    font-size: 0.875rem;
    color: var(--text, #e6ebef);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .popover-option:hover {
    background-color: var(--accent-soft, #1e293b);
    color: var(--accent, #3b82f6);
  }

  .popover-option.is-active {
    background-color: var(--accent, #3b82f6);
    color: #ffffff;
    font-weight: 600;
  }

  .sr-only-select {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
