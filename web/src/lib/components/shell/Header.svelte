<script lang="ts">
  import { Save, FolderOpen, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-svelte';
  import Select from '../form/Select.svelte';
  import ModalDialog from '../ui/ModalDialog.svelte';
  import TextInput from '../form/TextInput.svelte';
  import Alert from '../ui/Alert.svelte';
  import Button from '../ui/Button.svelte';
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
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (!node) continue;
        if (node.children && Array.isArray(node.children)) {
          const nextPrefix = prefix ? `${prefix} / ${node.label}` : node.label;
          traverse(node.children, nextPrefix);
        } else if (node.id) {
          const label = prefix ? `${prefix} / ${node.label}` : node.label;
          list.push({ id: node.id, label });
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

      <Button
        variant="secondary"
        class="header-btn"
        onclick={handleLoadConfig}
      >
        <FolderOpen size={15} />
        <span>Load</span>
      </Button>

      <Button
        variant="secondary"
        class="header-btn"
        onclick={openSavePresetModal}
      >
        <Save size={15} />
        <span>Save</span>
      </Button>
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
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={() => workspace.retry()}
        >
          <RotateCcw size={14} />
          <span>Retry</span>
        </Button>
      {:else if workspace.state === 'conflict'}
        <span class="state-badge state-conflict">Conflict</span>
        <Button
          variant="secondary"
          class="btn btn-secondary"
          onclick={() => workspace.reloadServer(true)}
        >
          <RefreshCw size={14} />
          <span>Reload</span>
        </Button>
        <Button
          variant="danger"
          class="btn btn-danger"
          onclick={() => workspace.overwriteServer()}
        >
          <AlertTriangle size={14} />
          <span>Overwrite</span>
        </Button>
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
  <Alert tone="error" class="save-error-toast">
    {saveError}
  </Alert>
{/if}

{#if trainingState === 'FAILED' && $trainingStore.status?.error_message}
  <Alert tone="error" class="save-error-toast">
    {$trainingStore.status.error_message}
  </Alert>
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
    <TextInput
      ariaLabel="Preset Name"
      value={presetName}
      placeholder="my_config"
      onInput={(value) => (presetName = value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          handleSavePreset();
        }
      }}
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
    <Button
      variant="danger"
      class="btn btn-danger"
      onclick={handleConfirmOverwrite}
    >
      Overwrite
    </Button>
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

  :global(.btn) {
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

  :global(.btn-secondary) {
    background-color: var(--control);
    color: var(--text);
    border-color: var(--line);
  }

  :global(.btn-danger) {
    background-color: var(--danger);
    color: #fff;
  }

  :global(.header-btn) {
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

  :global(.header-btn:hover) {
    background-color: var(--panel-raised, #1d242c);
    border-color: var(--accent, #3b82f6);
    color: var(--accent, #3b82f6);
  }

  :global(.header-btn:active) {
    transform: translateY(1px);
  }

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .modal-field :global(.text-input) {
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--line);
    background-color: var(--control);
    color: var(--text);
  }

  .error-msg,
  :global(.save-error-toast) {
    color: var(--danger);
    font-size: 0.875rem;
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
</style>
