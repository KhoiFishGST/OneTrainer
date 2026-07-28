<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { useQueryClient } from '@tanstack/svelte-query';
  import { ConfigWorkspace } from '../config/workspace.svelte';
  import { setRouteContext } from '../config/context';
  import {
    createHealthQuery,
    createMetaQuery,
    createConfigQuery,
    createSchemaQuery,
    createUpdateConfigMutation,
  } from '../api/queries';
  import Header from './shell/Header.svelte';
  import Rail from './shell/Rail.svelte';
  import StatusBar from './shell/StatusBar.svelte';
  import ConsoleDrawer from './shell/ConsoleDrawer.svelte';
  import ErrorBanner from './shell/ErrorBanner.svelte';
  import DirectoryPicker from './directory/DirectoryPicker.svelte';
  import Toaster from '$lib/components/ui/sonner/sonner.svelte';
  import { SidebarProvider } from '$lib/components/ui/sidebar';
  import { toast } from 'svelte-sonner';
  import { consoleStore } from '$lib/events/console-store.svelte';
  import { EventClient } from '$lib/events/client';
  import { api } from '$lib/api/client';

  let { children }: { children?: Snippet } = $props();

  const queryClient = useQueryClient();
  const healthQuery = createHealthQuery();
  const metaQuery = createMetaQuery();
  const configQuery = createConfigQuery();
  const updateConfigMutation = createUpdateConfigMutation();

  let workspace = $state<ConfigWorkspace | null>(null);
  let pickerOpen = $state(false);
  let pickerInitialPath = $state('/');
  let pickerOnSelect = $state<((selectedPath: string) => void) | null>(null);
  let isMobile = $state(false);
  let drawerOpen = $state(false);
  let eventClient = $state<EventClient | null>(null);

  const currentModelType = $derived(
    workspace?.draft?.model_type ?? $configQuery.data?.config?.model_type
  );
  const currentTrainingMethod = $derived(
    workspace?.draft?.training_method ?? $configQuery.data?.config?.training_method
  );

  const schemaQuery = $derived(createSchemaQuery(currentModelType, currentTrainingMethod));

  $effect(() => {
    if ($schemaQuery.data && workspace) {
      workspace.updateSchema($schemaQuery.data);
    }
  });

  $effect(() => {
    if ($configQuery.data) {
      if (!workspace) {
        if ($schemaQuery.data) {
          workspace = new ConfigWorkspace(
            $configQuery.data,
            $schemaQuery.data,
            (req) => $updateConfigMutation.mutateAsync(req)
          );
        }
      } else {
        workspace.acceptRemote($configQuery.data);
      }
    }
  });

  const schemaData = $derived($schemaQuery.data ?? {});

  let pickerMode = $state<'dir' | 'file' | 'both'>('dir');
  let pickerExtensions = $state<string[]>([]);

  setRouteContext({
    get workspace() {
      return workspace;
    },
    get schema() {
      return schemaData;
    },
    openDirectory: (currentPath: string, onSelect?: (selectedPath: string) => void) => {
      pickerMode = 'dir';
      pickerExtensions = [];
      pickerInitialPath = currentPath || '/';
      pickerOnSelect = onSelect ?? null;
      pickerOpen = true;
    },
    openFile: (currentPath: string, extensions: string[], onSelect?: (selectedPath: string) => void) => {
      pickerMode = 'file';
      pickerExtensions = extensions;
      pickerInitialPath = currentPath || 'training_configs';
      pickerOnSelect = onSelect ?? null;
      pickerOpen = true;
    },
  });

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      drawerOpen = localStorage.getItem('console_drawer_open') === 'true';
    }

    eventClient = new EventClient({
      store: consoleStore,
      getBacklog: () => api.getBacklog() as any,
      onConfigChanged: (_revision) => {
        queryClient.invalidateQueries({ queryKey: ['config'] });
      },
      onRestart: () => {
        queryClient.invalidateQueries({ queryKey: ['config'] });
      },
      onTrainingSample: (event) => {
        queryClient.invalidateQueries({ queryKey: ['gallery', 'current'] });
        queryClient.invalidateQueries({ queryKey: ['gallery', 'runs'] });
        if (event.run_key) {
          queryClient.invalidateQueries({ queryKey: ['gallery', 'runs', event.run_key] });
        }
      },
      onGalleryWarning: (event) => {
        toast.warning(event.message);
      },
    });
    eventClient.start();

    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(max-width: 767px)');
      isMobile = mq.matches;
      const handler = (e: MediaQueryListEvent) => {
        isMobile = e.matches;
      };
      mq.addEventListener('change', handler);
      return () => {
        mq.removeEventListener('change', handler);
        eventClient?.stop();
      };
    }

    return () => {
      eventClient?.stop();
    };
  });

  function toggleDrawer() {
    drawerOpen = !drawerOpen;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('console_drawer_open', drawerOpen.toString());
    }
  }

  function closeDrawer() {
    drawerOpen = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('console_drawer_open', 'false');
    }
  }

  const isApiError = $derived(
    $healthQuery.isError || $metaQuery.isError || $configQuery.isError || $schemaQuery.isError
  );
  const errorMessage = $derived(
    ($healthQuery.error as Error)?.message ||
      ($metaQuery.error as Error)?.message ||
      ($configQuery.error as Error)?.message ||
      ($schemaQuery.error as Error)?.message ||
      'API Connection Error'
  );

  const currentPath = $derived($page?.url?.pathname ?? '/live');
</script>

{#if currentPath === '/login'}
  {#if children}
    {@render children()}
  {/if}
{:else}
  <SidebarProvider class="app-shell">
    <Header />
    {#if isApiError}
      <ErrorBanner message={errorMessage} />
    {/if}
    <Toaster />

    <div class="shell-body">
      <Rail
        {currentPath}
        mobile={isMobile}
        onToggleConsole={toggleDrawer}
        isConsoleOpen={drawerOpen}
      />
      <div class="main-column">
        <main class="main-content">
          {#if children}
            {@render children()}
          {/if}
        </main>

        <ConsoleDrawer open={drawerOpen && currentPath !== '/console'} onClose={closeDrawer} store={consoleStore} />
        <StatusBar />
      </div>
    </div>

    <DirectoryPicker
      open={pickerOpen}
      initialPath={pickerInitialPath}
      mode={pickerMode}
      extensions={pickerExtensions}
      onSelect={(selectedPath) => {
        if (pickerOnSelect) {
          pickerOnSelect(selectedPath);
        }
        pickerOpen = false;
      }}
      onClose={() => {
        pickerOpen = false;
      }}
    />
  </SidebarProvider>
{/if}

<style>
  :global(.app-shell) {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    background-color: var(--bg);
    color: var(--text);
  }


  .shell-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    position: relative;
  }

  .main-column {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 16px;
  }
</style>
