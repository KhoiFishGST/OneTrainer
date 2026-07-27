<script lang="ts">
  import { Check, FolderKanban, AlertCircle } from 'lucide-svelte';
  import ModalDialog from '$lib/components/ui/ModalDialog.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import { createDatasetsQuery } from '$lib/api/queries';

  interface DatasetItem {
    name: string;
    path: string;
    image_count: number;
    caption_count: number;
    thumbnail_url: string;
  }

  let {
    open = false,
    currentPath = '',
    onSelect,
    onClose,
  }: {
    open: boolean;
    currentPath?: string;
    onSelect: (selectedPath: string) => void;
    onClose: () => void;
  } = $props();

  const datasetsQuery = createDatasetsQuery();

  let datasets = $derived($datasetsQuery.data?.datasets || []);
  let loading = $derived($datasetsQuery.isLoading);
  let selectedDataset = $state<DatasetItem | null>(null);

  $effect(() => {
    if (currentPath && datasets.length > 0 && !selectedDataset) {
      const matched = datasets.find(
        (d) => d.path === currentPath || d.name === currentPath
      );
      if (matched) selectedDataset = matched;
    }
  });

  function handleCardClick(ds: DatasetItem) {
    selectedDataset = ds;
  }

  function handleCardDblClick(ds: DatasetItem) {
    selectedDataset = ds;
    confirmSelection();
  }

  function confirmSelection() {
    if (selectedDataset) {
      onSelect(selectedDataset.path);
    }
  }
</script>

{#if open}
  <ModalDialog
    {open}
    title="Select Dataset"
    applyText="Select Dataset"
    cancelText="Cancel"
    onClose={onClose}
    onApply={confirmSelection}
  >
    <div class="picker-body">
      {#if loading}
        <div class="picker-loading">
          <span class="spinner"></span>
          <span>Loading datasets...</span>
        </div>
      {:else if datasets.length === 0}
        <div class="picker-empty">
          <AlertCircle size={40} />
          <p class="empty-title">No datasets available</p>
          <p class="empty-sub">
            Create a dataset in the <strong>Datasets</strong> tab first to select it here.
          </p>
        </div>
      {:else}
        <div class="dataset-grid">
          {#each datasets as ds (ds.name)}
            <Button
              type="button"
              variant="ghost"
              class={`dataset-card${selectedDataset?.name === ds.name ? ' selected' : ''}`}
              onclick={() => handleCardClick(ds)}
              ondblclick={() => handleCardDblClick(ds)}
            >
              <div class="card-bg">
                <img src={ds.thumbnail_url} alt={ds.name} class="card-bg-img" />
                <div class="card-overlay"></div>
                {#if selectedDataset?.name === ds.name}
                  <div class="selected-badge">
                    <Check size={16} />
                  </div>
                {/if}
              </div>
              <div class="card-content">
                <h3 class="card-title">{ds.name}</h3>
                <p class="card-meta">
                  {ds.image_count} images • {ds.caption_count} captions
                </p>
              </div>
            </Button>
          {/each}
        </div>
      {/if}
    </div>
  </ModalDialog>
{/if}

<style>
  .picker-body {
    min-height: 280px;
    max-height: 480px;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .picker-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 240px;
    gap: 1rem;
    color: var(--color-text-muted, #94a3b8);
  }

  .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--color-border, #334155);
    border-top-color: var(--color-primary, #3b82f6);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .picker-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 240px;
    gap: 0.75rem;
    color: var(--color-text-muted, #94a3b8);
    text-align: center;
  }

  .empty-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text, #f8fafc);
  }

  .empty-sub {
    font-size: 0.875rem;
  }

  .dataset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1rem;
  }

  :global(.dataset-card) {
    position: relative;
    border-radius: 10px;
    overflow: hidden;
    background: var(--color-bg-card, #1e293b);
    border: 2px solid var(--color-border, #334155);
    padding: 0;
    cursor: pointer;
    text-align: left;
    transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    display: flex;
    flex-direction: column;
  }

  :global(.dataset-card:hover) {
    transform: translateY(-2px);
    border-color: var(--color-primary-hover, #60a5fa);
  }

  :global(.dataset-card.selected) {
    border-color: var(--color-primary, #3b82f6);
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
  }

  .card-bg {
    position: relative;
    height: 120px;
    background: #0f172a;
    overflow: hidden;
  }

  .card-bg-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .card-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(15, 23, 42, 0.8), transparent);
  }

  .selected-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: var(--color-primary, #3b82f6);
    color: #ffffff;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  .card-content {
    padding: 0.75rem 1rem;
  }

  .card-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--color-text, #f8fafc);
    margin: 0 0 0.25rem 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .card-meta {
    font-size: 0.75rem;
    color: var(--color-text-muted, #94a3b8);
    margin: 0;
  }
</style>
