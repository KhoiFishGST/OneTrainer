<script lang="ts">
  import { Check, AlertCircle } from '@lucide/svelte';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import * as Empty from '$lib/components/ui/empty/index.js';
  import { ScrollArea } from '$lib/components/ui/scroll-area/index.js';
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
        (d: DatasetItem) => d.path === currentPath || d.name === currentPath
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
  <ResponsiveDialogDrawer
    {open}
    onOpenChange={(val) => { if (!val) onClose(); }}
    title="Select Dataset"
    class="max-w-3xl"
  >
    <ScrollArea class="min-h-[280px] max-h-[480px] p-2">
      {#if loading}
        <div class="flex flex-col items-center justify-center min-h-[240px] gap-4 text-muted-foreground">
          <div class="grid grid-cols-3 gap-4 w-full">
            <Skeleton class="h-[140px] w-full rounded-lg" />
            <Skeleton class="h-[140px] w-full rounded-lg" />
            <Skeleton class="h-[140px] w-full rounded-lg" />
          </div>
          <span>Loading datasets...</span>
        </div>
      {:else if datasets.length === 0}
        <Empty.Root class="flex flex-col items-center justify-center min-h-[240px] gap-3 text-center text-muted-foreground">
          <Empty.Media>
            <AlertCircle size={40} />
          </Empty.Media>
          <Empty.Header>
            <Empty.Title class="text-base font-semibold text-foreground">No datasets available</Empty.Title>
            <Empty.Description class="text-sm">
              Create a dataset in the <strong>Datasets</strong> tab first to select it here.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else}
        <div class="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {#each datasets as ds (ds.name)}
            <Button
              type="button"
              variant="ghost"
              class={`relative h-auto p-0 flex flex-col items-stretch text-left rounded-lg overflow-hidden bg-card border-2 border-border transition-all hover:-translate-y-0.5 hover:border-primary ${selectedDataset?.name === ds.name ? 'border-primary ring-2 ring-primary/30' : ''}`}
              onclick={() => handleCardClick(ds)}
              ondblclick={() => handleCardDblClick(ds)}
            >
              <div class="relative h-[120px] bg-slate-900 overflow-hidden">
                <img src={ds.thumbnail_url} alt={ds.name} class="w-full h-full object-cover" />
                <div class="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent"></div>
                {#if selectedDataset?.name === ds.name}
                  <div class="absolute top-2 right-2 bg-primary text-primary-foreground size-6 rounded-full flex items-center justify-center shadow-md">
                    <Check size={16} />
                  </div>
                {/if}
              </div>
              <div class="p-3 text-left w-full">
                <h3 class="text-sm font-semibold text-foreground m-0 mb-1 truncate">{ds.name}</h3>
                <p class="text-xs text-muted-foreground m-0">
                  <Badge variant="secondary">
                    {ds.image_count} images • {ds.caption_count} captions
                  </Badge>
                </p>
              </div>
            </Button>
          {/each}
        </div>
      {/if}
    </ScrollArea>
    {#snippet footer()}
      <div class="flex items-center justify-end gap-2 p-2">
        <Button variant="secondary" onclick={onClose}>Cancel</Button>
        <Button variant="default" disabled={!selectedDataset} onclick={confirmSelection}>Select Dataset</Button>
      </div>
    {/snippet}
  </ResponsiveDialogDrawer>
{/if}
