<script lang="ts">
  import { untrack, tick } from 'svelte';
  import { Folder, File, ArrowUp, X } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import Button from '$lib/components/ui/Button.svelte';
  import TextInput from '$lib/components/form/TextInput.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';

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
    open = false,
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

  let modalEl = $state<HTMLDivElement | null>(null);
  let pathInputControl = $state<{ focus: () => void } | null>(null);
  let previousActiveElement = $state<HTMLElement | null>(null);

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
      typedPath = directoryData.path;
    } catch (err: any) {
      error = err?.detail || err?.message || 'Failed to list directory';
      typedPath = targetPath;
    } finally {
      loading = false;
    }
  }

  $effect(() => {
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement | null;
      const startPath = untrack(() => initialPath);
      untrack(() => loadDirectory(startPath));
      tick().then(() => {
        pathInputControl?.focus();
      });
    } else {
      if (previousActiveElement) {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
      return;
    }

    if (e.key === 'Tab' && modalEl) {
      const focusableSelector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusables = Array.from(
        modalEl.querySelectorAll<HTMLElement>(focusableSelector)
      );

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !modalEl.contains(document.activeElement)) {
          lastEl.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastEl || !modalEl.contains(document.activeElement)) {
          firstEl.focus();
          e.preventDefault();
        }
      }
    }
  }

  function handleInputKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = (e.target as HTMLInputElement).value || typedPath;
      typedPath = val;
      loadDirectory(val);
    }
  }

  let selectBtnLabel = $derived(
    mode === 'file' ? 'Select File' : mode === 'both' ? 'Select Target' : 'Select Folder'
  );

  function handleClose() {
    if (onClose) {
      onClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleSelect() {
    if (isSelectDisabled) return;
    onSelect(selectedPath || currentPath);
    handleClose();
  }
</script>

{#if open}
  <div class="picker-backdrop" onclick={handleBackdropClick}>
    <div
      class="picker-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Server Directory Picker"
      tabindex="-1"
      onkeydown={handleKeyDown}
      bind:this={modalEl}
    >
      <div class="picker-header">
        <h3 class="picker-title">
          {mode === 'file' ? 'Select File' : mode === 'both' ? 'Select File or Directory' : 'Select Directory'}
        </h3>
        <Button variant="ghost" class="close-btn" aria-label="Close" onclick={handleClose}>
          <X size={20} />
        </Button>
      </div>

      <div class="picker-path-bar">
        <TextInput
          bind:this={pathInputControl}
          value={typedPath}
          class="path-input"
          placeholder="Enter path..."
          onInput={(value) => (typedPath = value)}
          onKeyDown={handleInputKeyDown}
        />
        <Button
          variant="secondary"
          class="nav-btn"
          onclick={() => loadDirectory(typedPath)}
          disabled={loading}
        >
          Go
        </Button>
      </div>

      <nav class="breadcrumb-bar" aria-label="Breadcrumb">
        {#each getBreadcrumbs(currentPath) as crumb, index (crumb.path)}
          {#if index > 0}
            <span class="crumb-separator">/</span>
          {/if}
          <Button
            variant="ghost"
            class={`crumb-btn${crumb.path === currentPath ? ' active' : ''}`}
            onclick={() => loadDirectory(crumb.path)}
          >
            {crumb.label}
          </Button>
        {/each}
      </nav>

      {#if directoryData?.roots && directoryData.roots.length > 0}
        <div class="roots-bar">
          <span class="roots-label">Roots:</span>
          {#each directoryData.roots as root}
            <Button
              variant="ghost"
              class="root-btn"
              onclick={() => loadDirectory(root)}
            >
              {root}
            </Button>
          {/each}
        </div>
      {/if}

      {#if error}
        <Alert tone="error" class="error-message">
          {error}
        </Alert>
      {/if}

      {#if directoryData?.truncated}
        <Alert tone="warning" class="warning-message">
          Results truncated. Refine your path or search.
        </Alert>
      {/if}

      <div class="picker-body">
        {#if directoryData?.parent}
          <Button
            variant="ghost"
            class="dir-item parent-item"
            onclick={() => loadDirectory(directoryData!.parent!)}
          >
            <ArrowUp size={16} />
            <span>..</span>
          </Button>
        {/if}

        {#if loading}
          <div class="loading-state">Loading...</div>
        {:else if directoryData && directoryData.entries.length > 0}
          <div class="dir-list">
            {#each directoryData.entries as item}
              {#if item.is_dir !== false}
                <Button
                  variant="ghost"
                  class="dir-item"
                  onclick={() => loadDirectory(item.path)}
                >
                  <Folder size={16} />
                  <span>{item.name}</span>
                </Button>
              {:else}
                <Button
                  variant="ghost"
                  class={`dir-item file-item${selectedPath === item.path ? ' selected' : ''}`}
                  onclick={() => {
                    selectedPath = item.path;
                    currentPath = item.path;
                  }}
                  ondblclick={() => {
                    onSelect(item.path);
                    handleClose();
                  }}
                >
                  <File size={16} />
                  <span class="file-name">{item.name}</span>
                  {#if item.size_bytes !== undefined}
                    <span class="file-size">{formatSize(item.size_bytes)}</span>
                  {/if}
                </Button>
              {/if}
            {/each}
          </div>
        {:else if !error}
          <div class="empty-state">No items found</div>
        {/if}
      </div>

      <div class="picker-footer">
        <Button variant="secondary" class="cancel-btn" onclick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          class="select-btn"
          disabled={isSelectDisabled}
          title={selectedPath || currentPath}
          onclick={handleSelect}
        >
          {selectBtnLabel}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .picker-modal {
    background: var(--panel, #181e25);
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    width: 100%;
    max-width: 650px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line, #2d3741);
    background: var(--panel, #181e25);
  }

  .picker-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text, #e6ebef);
  }

  :global(.close-btn) {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted, #8995a1);
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  :global(.close-btn:hover) {
    background: var(--panel-raised, #1d242c);
    color: var(--text, #e6ebef);
  }

  .picker-path-bar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line, #2d3741);
    background: var(--panel, #181e25);
  }

  :global(.path-input) {
    flex: 1;
    padding: 6px 12px;
    background: var(--control, #14191f);
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    font-size: 0.875rem;
  }

  :global(.path-input:focus) {
    outline: none;
    border-color: var(--accent, #3b82f6);
  }

  :global(.nav-btn) {
    padding: 6px 16px;
    background: var(--control, #14191f);
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  :global(.nav-btn:hover:not(:disabled)) {
    background: var(--panel-raised, #1d242c);
  }

  .breadcrumb-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 16px;
    background: var(--panel-raised, #1d242c);
    border-bottom: 1px solid var(--line, #2d3741);
    font-size: 0.875rem;
    overflow-x: auto;
    white-space: nowrap;
  }

  .crumb-separator {
    color: var(--muted, #8995a1);
    font-size: 0.75rem;
    user-select: none;
  }

  :global(.crumb-btn) {
    background: transparent;
    border: none;
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--accent, #3b82f6);
    font-size: 0.875rem;
    cursor: pointer;
    font-weight: 400;
  }

  :global(.crumb-btn:hover) {
    background: var(--control, #14191f);
    text-decoration: underline;
  }

  :global(.crumb-btn.active) {
    font-weight: 600;
    color: var(--text, #e6ebef);
    cursor: default;
  }

  :global(.crumb-btn.active:hover) {
    text-decoration: none;
    background: transparent;
  }

  .roots-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--panel-raised, #1d242c);
    border-bottom: 1px solid var(--line, #2d3741);
    font-size: 0.875rem;
    overflow-x: auto;
  }

  .roots-label {
    font-weight: 500;
    color: var(--muted, #8995a1);
  }

  :global(.root-btn) {
    padding: 2px 8px;
    background: var(--control, #14191f);
    color: var(--text, #e6ebef);
    border: 1px solid var(--line, #2d3741);
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  :global(.error-message) {
    padding: 8px 16px;
    background: rgba(217, 120, 120, 0.15);
    color: var(--danger, #d97878);
    border-bottom: 1px solid var(--line, #2d3741);
    font-size: 0.875rem;
  }

  :global(.warning-message) {
    padding: 8px 16px;
    background: rgba(242, 161, 111, 0.15);
    color: var(--focus, #60a5fa);
    border-bottom: 1px solid var(--line, #2d3741);
    font-size: 0.875rem;
  }

  .picker-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: var(--panel, #181e25);
  }

  .dir-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :global(.dir-item) {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    text-align: left;
    font-size: 0.875rem;
    color: var(--text, #e6ebef);
    cursor: pointer;
    width: 100%;
  }

  :global(.dir-item:hover) {
    background: var(--panel-raised, #1d242c);
  }

  :global(.dir-item.selected) {
    background: var(--accent-soft, #2a2725);
    border-color: var(--accent, #3b82f6);
  }

  .file-name {
    flex: 1;
  }

  .file-size {
    font-size: 0.75rem;
    color: var(--muted, #8995a1);
  }

  :global(.parent-item) {
    font-weight: 500;
    color: var(--accent, #3b82f6);
  }

  .loading-state,
  .empty-state {
    padding: 24px;
    text-align: center;
    color: var(--muted, #8995a1);
    font-size: 0.875rem;
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--line, #2d3741);
    background: var(--control, #14191f);
  }

  :global(.cancel-btn) {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--line, #2d3741);
    color: var(--text, #e6ebef);
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  :global(.cancel-btn:hover) {
    background: var(--panel-raised, #1d242c);
  }

  :global(.select-btn) {
    padding: 8px 16px;
    background: var(--accent, #3b82f6);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  :global(.select-btn:hover:not(:disabled)) {
    background: var(--focus, #60a5fa);
  }

  :global(.select-btn:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive styles for phone (<768px) */
  @media (max-width: 768px) {
    .picker-backdrop {
      padding: 0;
    }

    .picker-modal {
      max-width: 100%;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
    }
  }
</style>
