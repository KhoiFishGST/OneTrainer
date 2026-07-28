<script lang="ts">
  import { Trash2, Plus, FolderOpen } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import AddCard from '$lib/components/collections/AddItemCard.svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { Alert } from '$lib/components/ui/alert';
  import { isMobile } from '$lib/hooks/is-mobile.svelte';

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

  const isDesktop = $derived(!isMobile.current);

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
                  class="btn-delete text-destructive hover:text-destructive hover:bg-destructive/10"
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
  <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
    <AddCard label="Add Dataset" onClick={onAdd} />

    {#each datasets as ds (ds.name)}
      <a href="/datasets/{encodeURIComponent(ds.name)}" class="no-underline text-inherit flex flex-col">
        <Card.Root class="card relative group overflow-hidden bg-card border border-border rounded-lg flex flex-col h-[220px] p-0 transition-all hover:border-primary hover:-translate-y-0.5">
          <div class="relative flex-1 bg-muted overflow-hidden">
            {#if ds.thumbnail_url}
              <img src={ds.thumbnail_url} alt={ds.name} class="w-full h-full object-cover" />
            {/if}
            <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent flex items-end">
              <span class="font-semibold text-white text-sm drop-shadow">{ds.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="btn-delete absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-destructive border-none p-2 rounded cursor-pointer opacity-100"
              aria-label="Delete dataset"
              title="Delete dataset"
              disabled={isDeleting || isPendingDelete}
              onclick={(e: MouseEvent) => promptDelete(e, ds.name)}
            >
              <Trash2 size={18} />
            </Button>
          </div>
          <Card.Footer class="p-2.5 bg-card border-t border-border">
            <Badge variant="secondary" class="text-xs text-muted-foreground">
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
