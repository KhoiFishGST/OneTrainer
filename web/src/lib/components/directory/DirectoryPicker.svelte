<script lang="ts">
  import { untrack } from 'svelte';
  import { Folder, ArrowUp, X } from 'lucide-svelte';
  import { api } from '$lib/api/client';

  interface DirectoryItem {
    name: string;
    path: string;
  }

  interface DirectoryData {
    path: string;
    parent?: string | null;
    directories: DirectoryItem[];
    roots?: string[];
    truncated?: boolean;
  }

  let {
    open = false,
    initialPath = '/',
    list,
    onSelect,
    onClose,
  }: {
    open?: boolean;
    initialPath?: string;
    list?: (path: string) => Promise<any>;
    onSelect: (path: string) => void;
    onClose?: () => void;
  } = $props();

  let currentPath = $state('/');
  let typedPath = $state('/');
  let loading = $state(false);
  let error = $state<string | null>(null);
  let directoryData = $state<DirectoryData | null>(null);

  async function loadDirectory(targetPath: string) {
    loading = true;
    error = null;
    try {
      const fetchFn = list ?? api.listDirectories;
      const res = await fetchFn(targetPath);
      
      const rawDirs = res.directories ?? res.entries?.filter((e: any) => e.is_dir) ?? [];
      const directories: DirectoryItem[] = rawDirs.map((d: any) => ({
        name: d.name,
        path: d.path,
      }));

      directoryData = {
        path: res.path ?? targetPath,
        parent: res.parent ?? null,
        directories,
        roots: res.roots ?? [],
        truncated: Boolean(res.truncated),
      };

      currentPath = directoryData.path;
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
      const startPath = untrack(() => initialPath);
      untrack(() => loadDirectory(startPath));
    }
  });

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
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

  function handleClose() {
    if (onClose) {
      onClose();
    }
  }

  function handleSelect() {
    onSelect(currentPath);
    handleClose();
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="picker-backdrop"
    role="dialog"
    aria-modal="true"
    aria-label="Select Directory"
    tabindex="-1"
    onkeydown={handleKeyDown}
  >
    <div class="picker-modal">
      <div class="picker-header">
        <h3 class="picker-title">Select Directory</h3>
        <button type="button" class="close-btn" aria-label="Close" onclick={handleClose}>
          <X size={20} />
        </button>
      </div>

      <div class="picker-path-bar">
        <input
          type="text"
          class="path-input"
          bind:value={typedPath}
          oninput={(e) => (typedPath = (e.target as HTMLInputElement).value)}
          onkeydown={handleInputKeyDown}
          placeholder="Enter path..."
        />
        <button
          type="button"
          class="nav-btn"
          onclick={() => loadDirectory(typedPath)}
          disabled={loading}
        >
          Go
        </button>
      </div>

      {#if directoryData?.roots && directoryData.roots.length > 0}
        <div class="roots-bar">
          <span class="roots-label">Roots:</span>
          {#each directoryData.roots as root}
            <button
              type="button"
              class="root-btn"
              onclick={() => loadDirectory(root)}
            >
              {root}
            </button>
          {/each}
        </div>
      {/if}

      {#if error}
        <div class="error-banner" role="alert">
          {error}
        </div>
      {/if}

      {#if directoryData?.truncated}
        <div class="warning-banner">
          Results truncated. Refine your path or search.
        </div>
      {/if}

      <div class="picker-body">
        {#if directoryData?.parent}
          <button
            type="button"
            class="dir-item parent-item"
            onclick={() => loadDirectory(directoryData!.parent!)}
          >
            <ArrowUp size={16} />
            <span>..</span>
          </button>
        {/if}

        {#if loading}
          <div class="loading-state">Loading...</div>
        {:else if directoryData && directoryData.directories.length > 0}
          <div class="dir-list">
            {#each directoryData.directories as dir}
              <button
                type="button"
                class="dir-item"
                onclick={() => loadDirectory(dir.path)}
              >
                <Folder size={16} />
                <span>{dir.name}</span>
              </button>
            {/each}
          </div>
        {:else if !error}
          <div class="empty-state">No subdirectories found</div>
        {/if}
      </div>

      <div class="picker-footer">
        <button type="button" class="cancel-btn" onclick={handleClose}>
          Cancel
        </button>
        <button
          type="button"
          class="select-btn"
          disabled={loading}
          onclick={handleSelect}
        >
          Select {currentPath}
        </button>
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
    background: var(--color-bg-card, #ffffff);
    color: var(--color-text, #111827);
    border-radius: 8px;
    width: 100%;
    max-width: 600px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .picker-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .close-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted, #6b7280);
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .close-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
  }

  .picker-path-bar {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .path-input {
    flex: 1;
    padding: 6px 12px;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
  }

  .nav-btn {
    padding: 6px 16px;
    background: var(--color-bg-button, #f3f4f6);
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .roots-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-bg-subtle, #f9fafb);
    border-bottom: 1px solid var(--color-border, #e5e7eb);
    font-size: 0.875rem;
    overflow-x: auto;
  }

  .roots-label {
    font-weight: 500;
    color: var(--color-text-muted, #6b7280);
  }

  .root-btn {
    padding: 2px 8px;
    background: var(--color-bg-card, #ffffff);
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .error-banner {
    padding: 8px 16px;
    background: #fee2e2;
    color: #991b1b;
    font-size: 0.875rem;
  }

  .warning-banner {
    padding: 8px 16px;
    background: #fef3c7;
    color: #92400e;
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
  }

  .dir-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .dir-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    text-align: left;
    font-size: 0.875rem;
    color: var(--color-text, #111827);
    cursor: pointer;
    width: 100%;
  }

  .dir-item:hover {
    background: var(--color-bg-hover, #f3f4f6);
  }

  .parent-item {
    font-weight: 500;
    color: var(--color-primary, #2563eb);
  }

  .loading-state,
  .empty-state {
    padding: 24px;
    text-align: center;
    color: var(--color-text-muted, #6b7280);
    font-size: 0.875rem;
  }

  .picker-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-subtle, #f9fafb);
  }

  .cancel-btn {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid var(--color-border, #d1d5db);
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .select-btn {
    padding: 8px 16px;
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
  }

  .select-btn:disabled {
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
