<script lang="ts">
  import { Save, FolderOpen, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-svelte';
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

  const workspace = $derived(workspaceProp ?? ctx?.workspace);
  const metaQuery = createMetaQuery();
  const presetsQuery = createPresetsQuery();
  const loadPresetMutation = createLoadPresetMutation();
  const savePresetMutation = createSavePresetMutation();

  const metaData = $derived(metaDataProp ?? $metaQuery.data);
  const presetsData = $derived(presetsDataProp ?? $presetsQuery.data);

  let presetName = $state('');
  let showSaveDialog = $state(false);
  let showOverwriteDialog = $state(false);
  let saveError = $state<string | null>(null);

  const modelTypes = $derived(
    metaData?.model_types?.map((mt: any) => ({
      value: mt.value,
      label: mt.label,
    })) ?? []
  );

  const currentModelType = $derived(workspace?.draft?.model_type ?? '');

  const currentModelTypeObj = $derived(
    metaData?.model_types?.find((mt: any) => mt.value === currentModelType)
  );

  const trainingMethods = $derived(
    currentModelTypeObj?.training_methods?.map((tm: any) => ({
      value: tm.value,
      label: tm.label,
    })) ?? []
  );

  const currentTrainingMethod = $derived(workspace?.draft?.training_method ?? '');

  const presetsTree = $derived(presetsData ?? []);

  const flattenedPresets = $derived.by(() => {
    const list: Array<{ id: string; label: string }> = [];

    function traverse(nodes: any[], prefix = '') {
      for (const node of nodes) {
        if (Array.isArray(node)) {
          const [name, children] = node;
          if (typeof children === 'string') {
            const label = prefix ? `${prefix} / ${name}` : name;
            list.push({ id: children, label });
          } else if (Array.isArray(children)) {
            const nextPrefix = prefix ? `${prefix} / ${name}` : name;
            traverse(children, nextPrefix);
          }
        }
      }
    }

    traverse(presetsTree);
    return list;
  });

  function handleModelTypeChange(newModelType: string) {
    if (!workspace) return;

    const newModelTypeObj = metaData?.model_types?.find(
      (mt: any) => mt.value === newModelType
    );
    const supportedMethods =
      newModelTypeObj?.training_methods?.map((tm: any) => tm.value) ?? [];

    if (
      supportedMethods.length > 0 &&
      !supportedMethods.includes(currentTrainingMethod)
    ) {
      workspace.setRaw('training_method', supportedMethods[0]);
    }

    workspace.setRaw('model_type', newModelType);
  }

  function handleTrainingMethodChange(newMethod: string) {
    if (!workspace) return;
    workspace.setRaw('training_method', newMethod);
  }

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

  function handleLoadConfig() {
    if (ctx?.openFile) {
      ctx.openFile('training_configs', ['.json'], async (selectedPath: string) => {
        if (!selectedPath || !workspace) return;
        try {
          const resp = await api.loadConfigFile(selectedPath, workspace.revision);
          if (resp) {
            workspace.acceptRemote(resp);
          }
        } catch (err: any) {
          saveError = err?.message ?? 'Failed to load configuration file';
        }
      });
    }
  }

  async function openSavePresetModal() {
    saveError = null;
    if (workspace) {
      try {
        await workspace.beforePresetSave();
      } catch (err: any) {
        saveError = err?.message ?? 'Cannot save configuration';
        return;
      }
    }
    showSaveDialog = true;
  }

  async function executeSaveConfig(overwrite = false) {
    if (!presetName.trim()) return;
    try {
      await api.saveConfigFile(presetName.trim(), overwrite);
      showSaveDialog = false;
      showOverwriteDialog = false;
      presetName = '';
      saveError = null;
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if (status === 409 || err?.detail?.exists) {
        showOverwriteDialog = true;
      } else {
        saveError = err?.message ?? 'Failed to save configuration file';
      }
    }
  }

  async function handleSavePreset() {
    await executeSaveConfig(false);
  }

  async function handleConfirmOverwrite() {
    await executeSaveConfig(true);
  }

  const trainingState = $derived($trainingStore.status?.state ?? 'IDLE');
</script>

<header class="header">
  <div class="header-left">
    <div class="brand">
      <img src="/logo.png" alt="OneTrainer Logo" class="brand-logo" />
      <span class="app-title">OneTrainer</span>
    </div>

    <div class="header-divider"></div>

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
        class="header-btn"
        onclick={handleLoadConfig}
      >
        <FolderOpen size={15} />
        <span>Load</span>
      </button>

      <button
        type="button"
        class="header-btn"
        onclick={openSavePresetModal}
      >
        <Save size={15} />
        <span>Save</span>
      </button>
    </div>
  </div>

  <div class="header-right">
    {#if workspace}
      {#if workspace.state === 'saved'}
        <span
          class="saved-icon-badge"
          title="All changes saved to training_presets/#.json"
          data-testid="saved-icon-badge"
        >
          <Save size={16} />
        </span>
      {:else if workspace.state === 'failed'}
        <span class="state-badge state-failed">Save Failed</span>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => workspace.retry()}
        >
          <RotateCcw size={14} />
          <span>Retry</span>
        </button>
      {:else if workspace.state === 'conflict'}
        <span class="state-badge state-conflict">Conflict</span>
        <button
          type="button"
          class="btn btn-secondary"
          onclick={() => workspace.reloadServer(true)}
        >
          <RefreshCw size={14} />
          <span>Reload</span>
        </button>
        <button
          type="button"
          class="btn btn-danger"
          onclick={() => workspace.overwriteServer()}
        >
          <AlertTriangle size={14} />
          <span>Overwrite</span>
        </button>
      {/if}
    {/if}

    <span
      data-testid="training-status-pill"
      class="status-pill status-{trainingState.toLowerCase()}"
      title={$trainingStore.status?.error_message ?? ''}
    >
      {trainingState}
    </span>
  </div>
</header>

{#if saveError && !showSaveDialog && !showOverwriteDialog}
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
  open={showSaveDialog && !showOverwriteDialog}
  title="Save Configuration"
  applyText="Save"
  cancelText="Cancel"
  onClose={() => (showSaveDialog = false)}
  onApply={handleSavePreset}
>
  {#if saveError}
    <p class="error-msg">{saveError}</p>
  {/if}
  <label class="modal-field">
    <span>Configuration Name</span>
    <input
      type="text"
      aria-label="Preset Name"
      bind:value={presetName}
      placeholder="my_config"
    />
  </label>
</ModalDialog>

<ModalDialog
  open={showOverwriteDialog}
  title="File Already Exists"
  applyText="OK"
  cancelText="Cancel"
  onClose={() => (showOverwriteDialog = false)}
  onApply={handleConfirmOverwrite}
>
  <p>The configuration file <strong>{presetName}.json</strong> already exists in <code>training_configs</code>.</p>
  <p>Do you want to overwrite it?</p>

  <div class="modal-extra-actions" style="margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;">
    <button
      type="button"
      class="btn btn-danger"
      onclick={handleConfirmOverwrite}
    >
      Overwrite
    </button>
  </div>
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

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }

  .header-divider {
    width: 1px;
    height: 24px;
    background-color: var(--line, #2d3741);
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
    flex-wrap: wrap;
  }

  .selector-field {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-select-wrapper {
    min-width: 140px;
  }

  .label-text {
    font-size: 0.75rem;
    color: var(--muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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

  .header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 32px;
    padding: 0 12px;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 4px;
    background-color: var(--control, #14191f);
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
    cursor: pointer;
    white-space: nowrap;
    align-self: flex-end;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.1s ease;
  }

  .header-btn:hover {
    background-color: var(--panel-raised, #1d242c);
    border-color: var(--accent, #3b82f6);
    color: var(--accent, #3b82f6);
  }

  .header-btn:active {
    transform: translateY(1px);
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
    gap: 4px;
    margin-bottom: 12px;
  }

  .modal-field input {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--line);
    background-color: var(--control);
    color: var(--text);
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

  .saved-icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--success, #10b981);
    padding: 4px;
    border-radius: 4px;
    opacity: 0.9;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .saved-icon-badge:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .status-pill {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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
    animation: statusPulse 2s ease-in-out infinite;
  }

  @keyframes statusPulse {
    0%, 100% {
      transform: scale(1);
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.2);
    }
    50% {
      transform: scale(1.05);
      box-shadow: 0 0 10px 2px rgba(59, 130, 246, 0.3);
    }
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
