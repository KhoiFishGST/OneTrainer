<script lang="ts">
  import { untrack, tick } from 'svelte';
  import { Folder, File, ArrowUp } from '@lucide/svelte';
  import { api } from '$lib/api/client';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import { Alert } from '$lib/components/ui/alert';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Skeleton } from '$lib/components/ui/skeleton';
  import { Empty, EmptyTitle } from '$lib/components/ui/empty';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';

  interface DirectoryItem {
    name: string;
    path: string;
    is_dir?: boolean;
    size_bytes?: number;
    modified?: number;
  }

  interface DirectoryData {
    path: string;
    parent?: string | null;
    directories: DirectoryItem[];
    entries: DirectoryItem[];
    roots?: string[];
    truncated?: boolean;
  }

  let {
    open = $bindable(false),
    initialPath = '/',
    mode = 'dir',
    extensions = [],
    list,
    onSelect,
    onClose,
  }: {
    open?: boolean;
    initialPath?: string;
    mode?: 'dir' | 'file' | 'both';
    extensions?: string[];
    list?: (path: string, mode?: 'dir' | 'file' | 'both', extensions?: string[]) => Promise<any>;
    onSelect: (path: string) => void;
    onClose?: () => void;
  } = $props();

  let currentPath = $state('/');
  let selectedPath = $state('/');
  let typedPath = $state('/');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let directoryData = $state<DirectoryData | null>(null);

  let selectedEntry = $derived(
    directoryData?.entries.find((e) => e.path === selectedPath)
  );
  let isSelectDisabled = $derived(
    loading || (mode === 'file' && (!selectedEntry || selectedEntry.is_dir !== false))
  );

  let pathInputControl = $state<any>(null);
  let previousActiveElement = $state<HTMLElement | null>(null);
  let initialized = false;

  function formatSize(bytes?: number): string {
    if (bytes === undefined || bytes === null) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function getBreadcrumbs(pathStr: string): { label: string; path: string }[] {
    if (!pathStr) return [];

    const isWindows = /^[a-zA-Z]:/.test(pathStr) || pathStr.includes('\\');
    const sep = pathStr.includes('\\') ? '\\' : '/';

    if (!isWindows) {
      const parts = pathStr.split('/').filter(Boolean);
      const crumbs = [{ label: '/', path: '/' }];
      let current = '';
      for (const part of parts) {
        current += '/' + part;
        crumbs.push({ label: part, path: current });
      }
      return crumbs;
    } else {
      const parts = pathStr.split(/[/\\]/).filter(Boolean);
      if (parts.length === 0) return [];

      const drive = parts[0];
      const crumbs = [{ label: drive + sep, path: drive + sep }];
      let current = drive;
      for (let i = 1; i < parts.length; i++) {
        current += sep + parts[i];
        crumbs.push({ label: parts[i], path: current });
      }
      return crumbs;
    }
  }

  async function loadDirectory(targetPath: string) {
    loading = true;
    error = null;
    try {
      const fetchFn = list ?? ((p: string) => api.listDirectory(p, mode, extensions));
      const res = await fetchFn(targetPath);
      
      const rawItems = res.entries ?? res.directories ?? [];
      const entries: DirectoryItem[] = rawItems.map((d: any) => ({
        name: d.name,
        path: d.path,
        is_dir: d.is_dir ?? true,
        size_bytes: d.size_bytes,
        modified: d.modified,
      }));

      const directories = entries.filter((e) => e.is_dir !== false);

      directoryData = {
        path: res.path ?? targetPath,
        parent: res.parent ?? null,
        directories,
        entries,
        roots: res.roots ?? [],
        truncated: Boolean(res.truncated),
      };

      currentPath = directoryData.path;
      selectedPath = directoryData.path;
      if (typedPath === targetPath || typedPath === '/') {
        typedPath = directoryData.path;
      }
    } catch (err: any) {
      error = err?.detail || err?.message || 'Directory is not readable';
      typedPath = targetPath;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (open) {
      const startPath = untrack(() => initialPath);
      if (!initialized) {
        initialized = true;
        if (!previousActiveElement && document.activeElement) {
          previousActiveElement = document.activeElement as HTMLElement;
        }
        untrack(() => loadDirectory(startPath));
        tick().then(() => {
          pathInputControl?.focus();
        });
      }
    } else {
      initialized = false;
      if (previousActiveElement) {
        const elToFocus = previousActiveElement;
        previousActiveElement = null;
        tick().then(() => {
          elToFocus.focus();
        });
      }
    }
  });

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const targetEl = e.target as HTMLInputElement;
      const val = targetEl?.value || typedPath;
      typedPath = val;
      loadDirectory(val);
    }
  }

  let selectBtnLabel = $derived(
    mode === 'file' ? 'Select File' : mode === 'both' ? 'Select Target' : 'Select Folder'
  );

  let modalTitle = $derived(
    mode === 'file' ? 'Select File' : mode === 'both' ? 'Select File or Directory' : 'Select Directory'
  );

  function handleClose() {
    open = false;
    if (onClose) {
      onClose();
    }
  }

  function handleSelect() {
    if (isSelectDisabled) return;
    const target = selectedPath || currentPath;
    onSelect(target);
    handleClose();
  }

  function handleOpenChange(newOpen: boolean) {
    if (!newOpen) {
      handleClose();
    }
  }
</script>

<!--
  The `data-[vaul-drawer-direction=bottom]:` variant on the height override is
  load-bearing. A plain `max-h-[90dvh]` loses to drawer-content's
  `data-[vaul-drawer-direction=bottom]:max-h-[80dvh]` on specificity -- the
  same trap that shipped the deleted sheet at 293px wide. Matching the variant
  ties the specificity so ours (later in the stylesheet) wins. Drop the
  variant and the picker silently reverts to 80dvh.
-->
<ResponsiveDialogDrawer
  bind:open
  onOpenChange={handleOpenChange}
  title={modalTitle}
  class="sm:max-w-[650px] data-[vaul-drawer-direction=bottom]:max-h-[90dvh]"
>
  {#snippet children()}
    <!--
      md:p-1, not a plain p-1: this snippet renders inside BOTH
      ResponsiveDialogDrawer branches. The Drawer (mobile) branch already
      supplies px-4 via its own body wrapper, so padding here would double
      it. The Dialog (desktop) branch has no such wrapper -- Dialog.Content
      already applies p-4 of its own -- so it still needs this 4px. Dialog
      only renders at >=768px (`isMobile` is false), which is exactly
      Tailwind's `md` breakpoint, so `md:p-1` lands on the Dialog branch and
      nowhere else. Do not simplify this back to `p-1`.
    -->
    <div class="picker-container flex flex-col gap-3 md:p-1">
      <div class="picker-path-bar flex gap-2">
        <TextInput
          bind:this={pathInputControl}
          bind:value={typedPath}
          class="path-input flex-1 min-w-0"
          placeholder="Enter path..."
          onInput={(value) => (typedPath = value)}
          onKeyDown={handleInputKeyDown}
        />
        <Button
          variant="secondary"
          class="nav-btn shrink-0"
          onclick={() => loadDirectory(typedPath)}
          disabled={loading}
        >
          Go
        </Button>
      </div>

      <nav class="breadcrumb-bar flex items-center gap-1 overflow-x-auto py-1 text-sm whitespace-nowrap" aria-label="Breadcrumb">
        {#each getBreadcrumbs(currentPath) as crumb, index (crumb.path)}
          {#if index > 0}
            <span class="crumb-separator text-xs text-muted-foreground">/</span>
          {/if}
          <Button
            variant="ghost"
            class={`crumb-btn h-auto px-1.5 py-0.5 text-sm ${crumb.path === currentPath ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onclick={() => loadDirectory(crumb.path)}
          >
            {crumb.label}
          </Button>
        {/each}
      </nav>

      {#if directoryData?.roots && directoryData.roots.length > 0}
        <div class="roots-bar flex items-center gap-2 overflow-x-auto py-1 text-sm">
          <span class="roots-label font-medium text-muted-foreground">Roots:</span>
          {#each directoryData.roots as root}
            <Button
              variant="ghost"
              class="root-btn h-auto px-2 py-0.5 text-xs"
              onclick={() => loadDirectory(root)}
            >
              {root}
            </Button>
          {/each}
        </div>
      {/if}

      {#if error}
        <Alert variant="destructive" class="error-message">
          {error}
        </Alert>
      {/if}

      {#if directoryData?.truncated}
        <Alert class="warning-message">
          Results truncated. Refine your path or search.
        </Alert>
      {/if}

      <ScrollArea class="picker-body h-[280px] w-full rounded-md border border-border p-2">
        {#if directoryData?.parent}
          <Button
            variant="ghost"
            class="dir-item parent-item flex w-full items-center gap-2 justify-start font-medium text-primary hover:bg-accent"
            onclick={() => loadDirectory(directoryData!.parent!)}
          >
            <ArrowUp size={16} />
            <span>..</span>
          </Button>
        {/if}

        {#if loading}
          <div class="loading-state space-y-2 p-2" data-testid="directory-skeleton">
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
            <Skeleton class="h-8 w-full" />
          </div>
        {:else if directoryData && directoryData.entries.length > 0}
          <div class="dir-list flex flex-col gap-1">
            {#each directoryData.entries as item}
              {#if item.is_dir !== false}
                <Button
                  variant="ghost"
                  class="dir-item flex w-full items-center gap-2 justify-start font-normal hover:bg-accent text-left"
                  onclick={() => loadDirectory(item.path)}
                >
                  <Folder size={16} class="shrink-0" />
                  <span class="truncate">{item.name}</span>
                </Button>
              {:else}
                <Button
                  variant="ghost"
                  class={`dir-item file-item flex w-full items-center gap-2 justify-start text-left font-normal hover:bg-accent ${selectedPath === item.path ? 'bg-accent font-medium' : ''}`}
                  onclick={() => {
                    selectedPath = item.path;
                    currentPath = item.path;
                  }}
                  ondblclick={() => {
                    onSelect(item.path);
                    handleClose();
                  }}
                >
                  <File size={16} class="shrink-0" />
                  <span class="file-name flex-1 truncate">{item.name}</span>
                  {#if item.size_bytes !== undefined}
                    <span class="file-size text-xs text-muted-foreground shrink-0">{formatSize(item.size_bytes)}</span>
                  {/if}
                </Button>
              {/if}
            {/each}
          </div>
        {:else if !error}
          <Empty class="py-8 text-center">
            <EmptyTitle>No items found</EmptyTitle>
          </Empty>
        {/if}
      </ScrollArea>
    </div>
  {/snippet}

  {#snippet footer()}
    <div class="picker-footer flex items-center justify-end gap-2 w-full pt-2">
      <Button variant="secondary" class="cancel-btn" onclick={handleClose}>
        Cancel
      </Button>
      <Button
        variant="default"
        class="select-btn"
        disabled={isSelectDisabled}
        title={selectedPath || currentPath}
        onclick={handleSelect}
      >
        {selectBtnLabel}
      </Button>
    </div>
  {/snippet}
</ResponsiveDialogDrawer>
