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
    createAppearanceQuery,
    createUpdateAppearanceMutation,
  } from '../api/queries';
  import { appearance } from '$lib/stores/appearance.svelte';
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
  import { uploadQueue } from '$lib/upload/upload-queue.svelte';
  import { coalesceByKey } from '$lib/upload/coalesce';

  let { children }: { children?: Snippet } = $props();

  const queryClient = useQueryClient();
  const healthQuery = createHealthQuery();
  const metaQuery = createMetaQuery();
  const configQuery = createConfigQuery();
  const updateConfigMutation = createUpdateConfigMutation();
  const appearanceQuery = createAppearanceQuery();
  const updateAppearanceMutation = createUpdateAppearanceMutation();

  // The store performs no I/O of its own; this is where a local change becomes
  // a write. Applying to the DOM already happened inside the setter, so a slow
  // or failed request never delays the user's own click.
  // Cleared on destroy: the store is a module singleton, so a live closure
  // left behind here would keep firing mutations against a torn-down
  // component (and, in tests, against the previous test's query client).
  $effect(() => {
    appearance.onChange = (update) => {
      $updateAppearanceMutation.mutate(update);
    };
    return () => {
      appearance.onChange = null;
    };
  });

  // Mirror the appearance query's cache into the DOM/localStorage cache.
  // The mutation now writes to this cache optimistically (see
  // createUpdateAppearanceMutation), so this effect also fires on the
  // in-flight optimistic value -- that's fine, since acceptRemote is
  // idempotent and the optimistic value already matches what the setter
  // applied to the DOM directly. On a failed save the mutation's onError
  // restores the previous value into the cache (firing this effect again)
  // and also calls acceptRemote synchronously itself, so the rollback is
  // visible immediately rather than waiting on this effect to reschedule.
  $effect(() => {
    if ($appearanceQuery.data) {
      appearance.acceptRemote($appearanceQuery.data);
    }
  });

  let workspace = $state<ConfigWorkspace | null>(null);
  let pickerOpen = $state(false);
  let pickerInitialPath = $state('/');
  let pickerOnSelect = $state<((selectedPath: string) => void) | null>(null);
  let drawerOpen = $state(false);
  let eventClient = $state<EventClient | null>(null);

  // Both are overlays: neither is imported until the user opens one (or the
  // idle-time preload below fires), so keeping them out of the first-paint
  // graph costs nothing at load. ConsoleDrawer stays mounted-but-closed once
  // loaded (it animates its own open/close), while DirectoryPicker still
  // unmounts between opens.
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

  const refreshDataset = coalesceByKey((dataset: string) => {
    queryClient.invalidateQueries({ queryKey: ['datasets'] });
    queryClient.invalidateQueries({ queryKey: ['datasets', dataset, 'files'] });
  });

  onMount(() => {
    if (typeof localStorage !== 'undefined') {
      drawerOpen = localStorage.getItem('console_drawer_open') === 'true';
    }

    // The uploading tab refreshes off its own completions rather than the
    // event stream, so a shed event cannot leave it showing a stale grid.
    uploadQueue.onFileSettled = refreshDataset;

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
      // Only refreshes the view. Upload completion is driven by each
      // upload's own HTTP response, because this channel sheds messages
      // under a burst and never replays them.
      onDatasetFileAdded: (event) => refreshDataset(event.dataset),
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
      // The drawer needs to actually paint at its closed (0-height) state
      // before we flip it open, otherwise the browser coalesces the mount
      // and the open into a single frame and the height transition has no
      // starting point to animate from -- it pops instead of sliding. This
      // race is normally hidden by the idle-time preload in onMount below,
      // which has usually already loaded the module by the time the user
      // clicks; it only shows up on a cold first click.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
  // Trailing slashes are equivalent routes, and an exact compare against
  // '/console' would leave the drawer's console live alongside the page's.
  const isConsolePage = $derived(currentPath.replace(/\/+$/, '') === '/console');
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
        <ConsoleDrawer open={drawerOpen && !isConsolePage} onClose={closeDrawer} store={consoleStore} />
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
