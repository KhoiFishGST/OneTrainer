<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import AddCard from '$lib/components/collections/AddItemCard.svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { Alert } from '$lib/components/ui/alert';

  interface DatasetItem {
    name: string;
    path: string;
    image_count: number;
    caption_count: number;
    thumbnail_url: string;
  }

  let {
    datasets = [],
    onDelete = () => {},
    onAdd = () => {},
    isDeleting = false,
  }: {
    datasets?: DatasetItem[];
    onDelete?: (name: string) => Promise<void> | void;
    onAdd?: () => void;
    isDeleting?: boolean;
  } = $props();

  let datasetToDelete = $state<string | null>(null);
  let isConfirmOpen = $state(false);
  let isPendingDelete = $state(false);
  let deleteError = $state<string | null>(null);

  function promptDelete(e: MouseEvent, name: string) {
    e.stopPropagation();
    e.preventDefault();
    datasetToDelete = name;
    deleteError = null;
    isConfirmOpen = true;
  }

  async function confirmDelete() {
    if (!datasetToDelete || isPendingDelete) return;
    const targetName = datasetToDelete;
    deleteError = null;
    isPendingDelete = true;
    try {
      await onDelete(targetName);
      isConfirmOpen = false;
      datasetToDelete = null;
    } catch (err: any) {
      deleteError = err?.message || 'Failed to delete dataset';
    } finally {
      isPendingDelete = false;
    }
  }
</script>

<div class="datasets-grid">
  <AddCard label="Add Dataset" onClick={onAdd} />

  {#each datasets as ds (ds.name)}
    <a href="/datasets/{encodeURIComponent(ds.name)}" class="dataset-card-link">
      <Card.Root class="card dataset-card">
        <div class="thumbnail-wrapper">
          {#if ds.thumbnail_url}
            <img src={ds.thumbnail_url} alt={ds.name} class="thumbnail-img" />
          {/if}
          <div class="thumbnail-overlay">
            <span class="dataset-name">{ds.name}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            class="btn-delete"
            aria-label="Delete dataset"
            title="Delete dataset"
            disabled={isDeleting || isPendingDelete}
            onclick={(e: MouseEvent) => promptDelete(e, ds.name)}
          >
            <Trash2 size={16} />
          </Button>
        </div>
        <Card.Footer class="card-footer">
          <Badge variant="secondary" class="count-badge">
            {ds.image_count} {ds.image_count === 1 ? 'image' : 'images'} • {ds.caption_count} {ds.caption_count === 1 ? 'caption' : 'captions'}
          </Badge>
        </Card.Footer>
      </Card.Root>
    </a>
  {/each}
</div>

{#if isConfirmOpen && datasetToDelete}
  <AlertDialog.Root open={isConfirmOpen} onOpenChange={(v) => { if (!v && !isPendingDelete) { isConfirmOpen = false; datasetToDelete = null; deleteError = null; } }}>
    <AlertDialog.Content>
      <AlertDialog.Header>
        <AlertDialog.Title>Delete Dataset</AlertDialog.Title>
        <AlertDialog.Description>
          Are you sure you want to delete dataset "{datasetToDelete}"?
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if deleteError}
        <Alert variant="destructive" class="my-2">
          <span>{deleteError}</span>
        </Alert>
      {/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={isPendingDelete} onclick={() => { isConfirmOpen = false; datasetToDelete = null; deleteError = null; }}>
          Cancel
        </AlertDialog.Cancel>
        <AlertDialog.Action disabled={isDeleting || isPendingDelete} onclick={confirmDelete}>
          Delete
        </AlertDialog.Action>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<style>
  .datasets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .dataset-card-link {
    text-decoration: none;
    color: inherit;
    display: flex;
    flex-direction: column;
  }

  :global(.dataset-card) {
    background: var(--panel, #182026) !important;
    border: 1px solid var(--line, #2d3741) !important;
    border-radius: 8px !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 220px;
    padding: 0 !important;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  :global(.dataset-card:hover) {
    border-color: var(--accent, #3b82f6) !important;
    transform: translateY(-2px);
  }

  .thumbnail-wrapper {
    position: relative;
    flex: 1;
    background: var(--control, #101419);
    overflow: hidden;
  }

  .thumbnail-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .thumbnail-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.75rem;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
    display: flex;
    align-items: flex-end;
  }

  .dataset-name {
    font-weight: 600;
    color: #ffffff;
    font-size: 0.9375rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .thumbnail-wrapper :global(.btn-delete) {
    min-height: 0;
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: var(--danger, #ef4444);
    padding: 0.375rem;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .dataset-card-link:hover :global(.btn-delete) {
    opacity: 1;
  }

  :global(.card-footer) {
    padding: 0.625rem 0.75rem !important;
    background: var(--panel, #182026);
    border-top: 1px solid var(--line, #2d3741);
  }

  :global(.count-badge) {
    font-size: 0.75rem !important;
    color: var(--muted, #8995a1) !important;
  }
</style>
