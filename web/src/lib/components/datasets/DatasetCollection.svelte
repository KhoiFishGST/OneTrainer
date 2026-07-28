<script lang="ts">
  import { onMount } from 'svelte';
  import { Trash2, Plus, FolderOpen } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import AddCard from '$lib/components/collections/AddItemCard.svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
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

  let isDesktop = $state(true);

  onMount(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    isDesktop = mediaQuery.matches;
    const handler = (e: MediaQueryListEvent) => {
      isDesktop = e.matches;
    };
    mediaQuery.addEventListener?.('change', handler) ?? mediaQuery.addListener?.(handler);
    return () => {
      mediaQuery.removeEventListener?.('change', handler) ?? mediaQuery.removeListener?.(handler);
    };
  });

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
      await onDelete?.(targetName);
      isConfirmOpen = false;
      datasetToDelete = null;
    } catch (err: any) {
      deleteError = err?.message || 'Failed to delete dataset';
    } finally {
      isPendingDelete = false;
    }
  }
</script>

{#if isDesktop}
  <div class="space-y-4">
    <div class="flex justify-end">
      <Button onclick={onAdd} class="gap-2">
        <Plus size={16} /> Add Dataset
      </Button>
    </div>
    <div class="rounded-md border border-border overflow-hidden bg-card">
      <Table.Root>
        <Table.Header>
          <Table.Row>
            <Table.Head class="w-[300px]">Dataset</Table.Head>
            <Table.Head>Path</Table.Head>
            <Table.Head>Count</Table.Head>
            <Table.Head class="w-[100px] text-right">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each datasets as ds (ds.name)}
            <Table.Row class="hover:bg-muted/50 cursor-pointer" onclick={() => window.location.href = `/datasets/${encodeURIComponent(ds.name)}`}>
              <Table.Cell class="font-medium">
                <a href="/datasets/{encodeURIComponent(ds.name)}" class="flex items-center gap-3 no-underline text-foreground" onclick={(e) => e.stopPropagation()}>
                  {#if ds.thumbnail_url}
                    <img src={ds.thumbnail_url} alt={ds.name} class="w-10 h-10 rounded object-cover border border-border flex-shrink-0" />
                  {:else}
                    <div class="w-10 h-10 rounded bg-muted flex items-center justify-center text-muted-foreground flex-shrink-0">
                      <FolderOpen size={20} />
                    </div>
                  {/if}
                  <span class="font-semibold text-foreground hover:underline">{ds.name}</span>
                </a>
              </Table.Cell>
              <Table.Cell class="text-muted-foreground text-xs font-mono truncate max-w-[250px]">
                {ds.path}
              </Table.Cell>
              <Table.Cell>
                <Badge variant="secondary" class="font-normal text-xs">
                  {ds.image_count} {ds.image_count === 1 ? 'image' : 'images'} • {ds.caption_count} {ds.caption_count === 1 ? 'caption' : 'captions'}
                </Badge>
              </Table.Cell>
              <Table.Cell class="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  class="btn-delete text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px] h-11 w-11 touch-target-44"
                  aria-label="Delete dataset"
                  title="Delete dataset"
                  disabled={isDeleting || isPendingDelete}
                  onclick={(e: MouseEvent) => promptDelete(e, ds.name)}
                >
                  <Trash2 size={18} />
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  </div>
{:else}
  <div class="datasets-grid">
    <AddCard label="Add Dataset" onClick={onAdd} />

    {#each datasets as ds (ds.name)}
      <a href="/datasets/{encodeURIComponent(ds.name)}" class="dataset-card-link">
        <Card.Root class="card dataset-card relative group overflow-hidden bg-card border-border">
          <div class="thumbnail-wrapper relative flex-1 bg-muted overflow-hidden">
            {#if ds.thumbnail_url}
              <img src={ds.thumbnail_url} alt={ds.name} class="thumbnail-img w-full h-full object-cover" />
            {/if}
            <div class="thumbnail-overlay absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-end">
              <span class="dataset-name font-semibold text-white text-sm drop-shadow">{ds.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="btn-delete absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-destructive border-none p-2 rounded cursor-pointer min-h-[44px] min-w-[44px] h-11 w-11 touch-target-44 opacity-100"
              aria-label="Delete dataset"
              title="Delete dataset"
              disabled={isDeleting || isPendingDelete}
              onclick={(e: MouseEvent) => promptDelete(e, ds.name)}
            >
              <Trash2 size={18} />
            </Button>
          </div>
          <Card.Footer class="card-footer p-2.5 bg-card border-t border-border">
            <Badge variant="secondary" class="count-badge text-xs text-muted-foreground">
              {ds.image_count} {ds.image_count === 1 ? 'image' : 'images'} • {ds.caption_count} {ds.caption_count === 1 ? 'caption' : 'captions'}
            </Badge>
          </Card.Footer>
        </Card.Root>
      </a>
    {/each}
  </div>
{/if}

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
    background: var(--card, #182026) !important;
    border: 1px solid var(--border, #2d3741) !important;
    border-radius: 8px !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    height: 220px;
    padding: 0 !important;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  :global(.dataset-card:hover) {
    border-color: var(--primary, #3b82f6) !important;
    transform: translateY(-2px);
  }

  .thumbnail-wrapper {
    position: relative;
    flex: 1;
    background: var(--muted, #101419);
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
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.6);
    border: none;
    color: var(--destructive, #ef4444);
    padding: 0.375rem;
    border-radius: 4px;
    cursor: pointer;
    opacity: 1;
  }

  :global(.card-footer) {
    padding: 0.625rem 0.75rem !important;
    background: var(--card, #182026);
    border-top: 1px solid var(--border, #2d3741);
  }

  :global(.count-badge) {
    font-size: 0.75rem !important;
    color: var(--muted-foreground, #8995a1) !important;
  }
</style>
