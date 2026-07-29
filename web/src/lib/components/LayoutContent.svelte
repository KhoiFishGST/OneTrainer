<script lang="ts">
  import type { Snippet } from 'svelte';
  import { page } from '$app/stores';
  import { onMount, tick } from 'svelte';
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
  import ErrorBanner from './shell/ErrorBanner.svelte';
  import Toaster from '$lib/components/ui/sonner/sonner.svelte';
  import { SidebarProvider } from '$lib/components/ui/sidebar';
  import { toast } from 'svelte-sonner';
  import { consoleStore } from '$lib/events/console-store.svelte';
  import { EventClient } from '$lib/events/client';
  import { api } from '$lib/api/client';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';

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
  let drawerOpen = $state(false);
  let eventClient = $state<EventClient | null>(null);

  // Both are overlays: nothing renders them until the user opens one, so
  // keeping them out of the first-paint graph costs nothing at runtime.
  let ConsoleDrawer = $state<typeof import('./shell/ConsoleDrawer.svelte').default | null>(null);
  let DirectoryPicker = $state<typeof import('./directory/DirectoryPicker.svelte').default | null>(null);

  $effect(() => {
    if (drawerOpen && !ConsoleDrawer) {
      import('./shell/ConsoleDrawer.svelte').then((module) => {
        ConsoleDrawer = module.default;
      });
    }
  });

  $effect(() => {
    if (pickerOpen && !DirectoryPicker) {
      import('./directory/DirectoryPicker.svelte').then((module) => {
        DirectoryPicker = module.default;
      });
    }
  });

  onMount(() => {
    const preloadOverlays = () => {
      if (!ConsoleDrawer) {
        import('./shell/ConsoleDrawer.svelte').then((m) => {
          ConsoleDrawer = m.default;
        });
      }
      if (!DirectoryPicker) {
        import('./directory/DirectoryPicker.svelte').then((m) => {
          DirectoryPicker = m.default;
        });
      }
    };
    if (typeof requestIdleCallback !== 'undefined') {
      requestIdleCallback(preloadOverlays);
    } else {
      setTimeout(preloadOverlays, 50);
    }
  });

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
    openDirectory: async (currentPath: string, onSelect?: (selectedPath: string) => void) => {
      pickerMode = 'dir';
      pickerExtensions = [];
      pickerInitialPath = currentPath || '/';
      pickerOnSelect = onSelect ?? null;
      if (!DirectoryPicker) {
        const mod = await import('./directory/DirectoryPicker.svelte');
        DirectoryPicker = mod.default;
        await tick();
      }
      pickerOpen = true;
    },
    openFile: async (currentPath: string, extensions: string[], onSelect?: (selectedPath: string) => void) => {
      pickerMode = 'file';
      pickerExtensions = extensions;
      pickerInitialPath = currentPath || 'training_configs';
      pickerOnSelect = onSelect ?? null;
      if (!DirectoryPicker) {
        const mod = await import('./directory/DirectoryPicker.svelte');
        DirectoryPicker = mod.default;
        await tick();
      }
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

    return () => {
      eventClient?.stop();
    };
  });

  async function toggleDrawer() {
    const nextState = !drawerOpen;
    if (nextState && !ConsoleDrawer) {
      const mod = await import('./shell/ConsoleDrawer.svelte');
      ConsoleDrawer = mod.default;
      await tick();
    }
    drawerOpen = nextState;
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

<SidebarProvider class="app-shell flex flex-col h-[100dvh] w-screen overflow-hidden bg-background text-foreground">
  <Header />
  {#if isApiError}
    <ErrorBanner message={errorMessage} />
  {/if}
  <Toaster />

  <div class="flex-1 flex overflow-hidden relative">
    <Rail
      {currentPath}
      mobile={isMobile.current}
      onToggleConsole={toggleDrawer}
      isConsoleOpen={drawerOpen}
    />
    <div class="flex-1 flex flex-col overflow-hidden relative">
      <main class="main-content flex-1 flex flex-col overflow-y-auto p-4">
        {#if children}
          {@render children()}
        {/if}
      </main>

      {#if ConsoleDrawer}
        <ConsoleDrawer open={drawerOpen && currentPath !== '/console'} onClose={closeDrawer} store={consoleStore} />
      {/if}
      <StatusBar />
    </div>
  </div>

  {#if DirectoryPicker}
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
  {/if}
</SidebarProvider>
