<script lang="ts">
  import { tick } from 'svelte';
  import { Save, FolderOpen, RotateCcw, RefreshCw, AlertTriangle, Menu } from '@lucide/svelte';
  import Select from '../form/ValueSelect.svelte';
  import { Input as TextInput } from '../ui/input/index.js';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { useSidebar } from '$lib/components/ui/sidebar';
  import { cn } from '$lib/utils';
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
  import ThemeToggle from './ThemeToggle.svelte';

  const sidebar = (() => {
    try {
      return useSidebar();
    } catch {
      // Sidebar context is absent in isolated unit tests.
      return null;
    }
  })();

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

  // vaul + the bits-ui dialog machinery are ~100 KB and only ever needed once
  // the user saves a preset.
  let SaveDrawer = $state<typeof import('$lib/components/overlays/ResponsiveDialogDrawer.svelte').default | null>(null);
  let AlertDialog = $state<typeof import('../ui/alert-dialog/index.js') | null>(null);

  $effect(() => {
    if (showSaveDialog && !SaveDrawer) {
      import('$lib/components/overlays/ResponsiveDialogDrawer.svelte').then((module) => {
        SaveDrawer = module.default;
      });
    }
  });

  $effect(() => {
    if (showOverwriteDialog && !AlertDialog) {
      import('../ui/alert-dialog/index.js').then((module) => {
        AlertDialog = module;
      });
    }
  });

  let saveError = $state<string | null>(null);
  let isOverwritePending = $state(false);
  let overwriteError = $state<string | null>(null);

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
    overwriteError = null;
    if (!SaveDrawer) {
      const module = await import('$lib/components/overlays/ResponsiveDialogDrawer.svelte');
      SaveDrawer = module.default;
      await tick();
    }
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
    if (overwrite) {
      if (isOverwritePending) return;
      isOverwritePending = true;
      overwriteError = null;
    } else {
      saveError = null;
    }

    try {
      await api.saveConfigFile(presetName.trim(), overwrite);
      showSaveDialog = false;
      showOverwriteDialog = false;
      presetName = '';
      saveError = null;
      overwriteError = null;
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if (status === 409 || err?.detail?.exists) {
        overwriteError = null;
        if (!AlertDialog) {
          AlertDialog = await import('../ui/alert-dialog/index.js');
          await tick();
        }
        showOverwriteDialog = true;
      } else if (overwrite) {
        overwriteError = err?.message ?? 'Failed to overwrite configuration file';
      } else {
        saveError = err?.message ?? 'Failed to save configuration file';
      }
    } finally {
      if (overwrite) {
        isOverwritePending = false;
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

  const statusClasses: Record<string, string> = {
    IDLE: 'bg-muted text-muted-foreground border-border',
    STARTING: 'bg-info-surface text-info border-info/30 animate-pulse',
    TRAINING: 'bg-info-surface text-info border-info/30 animate-pulse',
    PAUSED: 'bg-warning-surface text-warning border-warning/30',
    STOPPING: 'bg-destructive-surface text-destructive border-destructive/40',
    FAILED: 'bg-destructive-surface text-destructive border-destructive/40',
    COMPLETED: 'bg-success-surface text-success border-success/30',
  };
</script>

<header class="header">
  <div class="header-left">
    {#if sidebar}
      <Button
        variant="ghost"
        size="icon"
        class="md:hidden"
        aria-label="Open navigation"
        onclick={() => sidebar.setOpenMobile(true)}
      >
        <Menu size={20} />
      </Button>
    {/if}
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
        size="sm"
        class="self-end gap-1.5"
        onclick={handleLoadConfig}
      >
        <FolderOpen size={15} />
        <span>Load</span>
      </Button>

      <Button
        variant="secondary"
        size="sm"
        class="self-end gap-1.5"
        onclick={openSavePresetModal}
      >
        <Save size={15} />
        <span>Save</span>
      </Button>
    </div>
  </div>

  <div class="header-right">
    <ThemeToggle />
    {#if workspace}
      {#if workspace.state === 'saved'}
        <span
          class="saved-icon-badge text-success"
          title="All changes saved to training_presets/#.json"
          data-testid="saved-icon-badge"
        >
          <Save size={16} />
        </span>
      {:else if workspace.state === 'failed'}
        <span class="state-badge bg-destructive-surface text-destructive">Save Failed</span>
        <Button
          variant="secondary"
          size="sm"
          onclick={() => workspace.retry()}
        >
          <RotateCcw size={14} />
          <span>Retry</span>
        </Button>
      {:else if workspace.state === 'conflict'}
        <span class="state-badge bg-destructive-surface text-destructive">Conflict</span>
        <Button
          variant="secondary"
          size="sm"
          onclick={() => workspace.reloadServer(true)}
        >
          <RefreshCw size={14} />
          <span>Reload</span>
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onclick={() => workspace.overwriteServer()}
        >
          <AlertTriangle size={14} />
          <span>Overwrite</span>
        </Button>
      {/if}
    {/if}

    <span
      data-testid="training-status-pill"
      class={cn('status-pill', statusClasses[trainingState] ?? statusClasses.IDLE)}
      title={$trainingStore.status?.error_message ?? ''}
    >
      {trainingState}
    </span>
  </div>
</header>

{#if saveError && !showSaveDialog && !showOverwriteDialog}
  <div class="header-alert-owner">
    <Alert variant="destructive">
      {saveError}
    </Alert>
  </div>
{/if}

{#if trainingState === 'FAILED' && $trainingStore.status?.error_message}
  <div class="header-alert-owner">
    <Alert variant="destructive">
      {$trainingStore.status.error_message}
    </Alert>
  </div>
{/if}

{#if SaveDrawer}
  <SaveDrawer
    open={showSaveDialog && !showOverwriteDialog}
    onOpenChange={(v) => { if (!v) showSaveDialog = false; }}
    title="Save Configuration"
  >
    {#if saveError}
      <p class="text-sm text-destructive">{saveError}</p>
    {/if}
    <label class="modal-field">
      <span>Configuration Name</span>
      <TextInput
        aria-label="Preset Name"
        bind:value={presetName}
        placeholder="my_config"
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            handleSavePreset();
          }
        }}
      />
    </label>
    {#snippet footer()}
      <div class="flex items-center justify-end gap-2 p-2">
        <Button variant="secondary" onclick={() => (showSaveDialog = false)}>Cancel</Button>
        <Button variant="default" onclick={handleSavePreset}>Save</Button>
      </div>
    {/snippet}
  </SaveDrawer>
{/if}

{#if showOverwriteDialog}
  {#if AlertDialog}
    <AlertDialog.Root open={showOverwriteDialog} onOpenChange={(v) => { if (!v && !isOverwritePending) showOverwriteDialog = false; }}>
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>File Already Exists</AlertDialog.Title>
          <AlertDialog.Description>
            The configuration file <strong>{presetName}.json</strong> already exists in <code>training_configs</code>. Do you want to overwrite it?
          </AlertDialog.Description>
        </AlertDialog.Header>
        {#if overwriteError}
          <Alert variant="destructive" class="my-2">
            <span>{overwriteError}</span>
          </Alert>
        {/if}
        <AlertDialog.Footer>
          <AlertDialog.Cancel disabled={isOverwritePending} onclick={() => (showOverwriteDialog = false)}>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action disabled={isOverwritePending} onclick={handleConfirmOverwrite}>
            Overwrite
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  {/if}
{/if}

<style>
  .header {
    height: auto;
    background-color: var(--card);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    gap: 12px;
    flex-wrap: wrap;
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
    background-color: var(--border);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 1.125rem;
    color: var(--ring);
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
    color: var(--muted-foreground);
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

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .header-alert-owner {
    display: contents;
  }

  .saved-icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
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
    border-width: 1px;
    border-style: solid;
  }
</style>

