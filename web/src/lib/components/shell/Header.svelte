<script lang="ts">
  import { tick } from 'svelte';
  import { Menu } from '@lucide/svelte';
  import { Input as TextInput } from '../ui/input/index.js';
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';
  import { useSidebar } from '$lib/components/ui/sidebar';
  import { getRouteContext } from '../../config/context';
  import type { ConfigWorkspace } from '../../config/workspace.svelte';
  import { api } from '../../api/client';
  import ThemeToggle from './ThemeToggle.svelte';
  import HeaderConfigControls from './HeaderConfigControls.svelte';
  import HeaderStatus from './HeaderStatus.svelte';
  import HeaderDesktopBar from './HeaderDesktopBar.svelte';
  import HeaderMobileBar from './HeaderMobileBar.svelte';

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

    <HeaderConfigControls {workspace} metaData={metaDataProp} presetsData={presetsDataProp}>
      {#snippet children(config)}
        <HeaderDesktopBar
          {config}
          onLoadConfig={handleLoadConfig}
          onSavePreset={openSavePresetModal}
        />
        <HeaderMobileBar
          {config}
          onLoadConfig={handleLoadConfig}
          onSavePreset={openSavePresetModal}
        />
      {/snippet}
    </HeaderConfigControls>
  </div>

  <div class="header-right">
    <ThemeToggle />
    <HeaderStatus {workspace} />
  </div>
</header>

{#if saveError && !showSaveDialog && !showOverwriteDialog}
  <div class="header-alert-owner">
    <Alert variant="destructive">
      {saveError}
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
    padding: 6px 16px;
    padding-top: calc(6px + env(safe-area-inset-top, 0px));
    gap: 12px;
    flex-wrap: wrap;
  }

  @media (max-width: 767px) {
    .header {
      padding: 4px 6px;
      padding-top: calc(4px + env(safe-area-inset-top, 0px));
      gap: 4px;
      flex-wrap: nowrap;
    }

    /*
      The row must be able to give. Pinning both sides to flex-shrink: 0 is
      what pushed the theme toggle outside the viewport -- and because the
      shell is overflow-hidden, it was clipped rather than scrolled, so
      nothing reported it.
    */
    .header-left {
      gap: 4px;
      min-width: 0;
      flex-shrink: 1;
    }

    .header-right {
      gap: 4px;
      flex-shrink: 0;
    }

    .brand {
      gap: 0;
      flex-shrink: 1;
      min-width: 0;
      overflow: hidden;
    }

    .app-title {
      display: none;
    }

    .header-divider {
      height: 18px;
    }
  }

  /*
    Below 380px the five config icons, the hamburger and the theme toggle
    consume the whole row. The wordmark is already gone; the logo and divider
    are the only remaining decoration, so they go next rather than pushing a
    control off-screen.
  */
  @media (max-width: 379px) {
    .header {
      padding: 4px 2px;
      gap: 0;
    }

    .header-left {
      gap: 0;
    }

    .brand,
    .header-divider {
      display: none;
    }
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

  .modal-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 12px;
  }

  .header-alert-owner {
    display: contents;
  }
</style>
