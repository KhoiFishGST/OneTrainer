<script lang="ts">
  import { Trash2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import AddCard from '$lib/components/collections/AddItemCard.svelte';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
  import { Alert } from '$lib/components/ui/alert';
  import { fade } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { MOTION, motionEnabled } from '$lib/motion';

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

<div class="datasets-grid grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-5">
  <AddCard label="Add Dataset" onClick={onAdd} />

  {#each datasets as ds (ds.name)}
    <a
      href="/datasets/{encodeURIComponent(ds.name)}"
      data-dataset-card
      class="dataset-card-link no-underline text-inherit flex flex-col"
      animate:flip={{ duration: motionEnabled() ? MOTION.layoutMs : 0 }}
      in:fade={{ duration: motionEnabled() ? MOTION.enterMs : 0 }}
      out:fade={{ duration: motionEnabled() ? MOTION.exitMs : 0 }}
    >
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
