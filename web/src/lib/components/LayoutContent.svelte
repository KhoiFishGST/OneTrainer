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

  setRouteContext({
    get workspace() {
      return workspace;
    },
    get schema() {
      return schemaData;
    },
    openDirectory: (currentPath: string, onSelect?: (selectedPath: string) => void) => {
      pickerInitialPath = currentPath || '/';
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
    });
    eventClient.start();

    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(max-width: 768px)');
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

  const currentPath = $derived($page?.url?.pathname ?? '/general');
</script>

{#if currentPath === '/login'}
  {#if children}
    {@render children()}
  {/if}
{:else}
  <div class="app-shell">
    <Header />
    {#if isApiError}
      <ErrorBanner message={errorMessage} />
    {/if}

    <div class="shell-body">
      <Rail {currentPath} mobile={isMobile} />
      <main class="main-content">
        {#if children}
          {@render children()}
        {/if}
      </main>
    </div>

    <ConsoleDrawer open={drawerOpen && currentPath !== '/console'} onClose={closeDrawer} store={consoleStore} />
    <StatusBar connected={$healthQuery.isSuccess} onToggleConsole={toggleDrawer} />

    <DirectoryPicker
      open={pickerOpen}
      initialPath={pickerInitialPath}
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
  </div>
{/if}

<style>
  .app-shell {
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

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 16px;
  }
</style>
