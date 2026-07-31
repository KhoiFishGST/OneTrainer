<script lang="ts">
  import { ArrowLeft, Upload, Image as ImageIcon, X } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { FileInput } from '$lib/components/ui/file-input/index.js';
  import * as Empty from '$lib/components/ui/empty/index.js';
  import DatasetFileCard from '$lib/components/datasets/DatasetFileCard.svelte';
  import UploadSkeletonCard from '$lib/components/datasets/UploadSkeletonCard.svelte';
  import UploadSummaryBar from '$lib/components/datasets/UploadSummaryBar.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import { uploadQueue } from '$lib/upload/upload-queue.svelte';
  import { UPLOAD_ACCEPT, isPlayableInBrowser } from '$lib/upload/media-kind';
  import {
    createDatasetFilesQuery,
    createUpdateCaptionMutation,
  } from '$lib/api/queries';

  let { data } = $props<{ data: { id: string } }>();
  let datasetName = $derived(data.id);

  // svelte-ignore state_referenced_locally
  const filesQuery = createDatasetFilesQuery(data.id);
  const captionMutation = createUpdateCaptionMutation();

  let items = $derived($filesQuery.data?.items || []);
  let loading = $derived($filesQuery.isLoading);
  let fileInput = $state<{ open: () => void } | null>(null);
  let isDragging = $state(false);
  let activeLightboxItem = $state<{ url: string; kind: string; filename: string } | null>(null);

  // 'done' files are already in the grid as real cards, and a canceled
  // transfer has nothing left to show or act on — neither should leave a
  // card behind, and the queue outlives this page.
  let pendingUploads = $derived(
    uploadQueue
      .entriesFor(datasetName)
      .filter((e) => e.status !== 'done' && e.status !== 'canceled')
  );
  let totals = $derived(uploadQueue.totals);

  function handleFileUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    uploadQueue.enqueue(datasetName, files);
  }

  async function handleCaptionSave(captionName: string, content: string) {
    if (!captionName) return;
    try {
      await $captionMutation.mutateAsync({
        name: datasetName,
        caption_name: captionName,
        content,
      });
    } catch (err) {
      console.error('Failed to save caption', err);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragging = false;
    if (e.dataTransfer?.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  }
</script>

<RoutePage>
  <div
    class="flex flex-col gap-6 relative"
    role="region"
    aria-label="Dataset Detail"
    ondragover={(e) => { e.preventDefault(); isDragging = true; }}
    ondragleave={() => (isDragging = false)}
    ondrop={handleDrop}
  >
    {#if isDragging}
      <div class="absolute inset-0 bg-slate-900/90 border-3 border-dashed border-primary z-[500] flex flex-col items-center justify-center gap-4 text-primary">
        <Upload size={48} />
        <span>Drop images or caption files here to upload</span>
      </div>
    {/if}

    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold text-primary m-0">{datasetName}</h1>
        <a href="/datasets" class="inline-flex items-center gap-1.5 text-muted-foreground text-sm mt-1 transition-colors hover:text-foreground no-underline">
          <ArrowLeft size={16} />
          <span>Back to Datasets</span>
        </a>
      </div>

      <Button variant="default" class="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer" onclick={() => fileInput?.open()}>
        <Upload size={18} />
        <span>Add Files</span>
      </Button>
      <FileInput
        bind:this={fileInput}
        multiple
        accept={UPLOAD_ACCEPT}
        class="hidden"
        onChange={(files) => files && handleFileUpload(files)}
      />
    </div>

    {#if pendingUploads.length > 0}
      <UploadSummaryBar {totals} onCancelAll={() => uploadQueue.cancelAll()} />
    {/if}

    {#if items.length === 0 && pendingUploads.length === 0 && !loading}
      <Empty.Root class="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
        <Empty.Media>
          <ImageIcon size={48} />
        </Empty.Media>
        <Empty.Header>
          <Empty.Title class="text-lg font-semibold text-foreground">No images, videos, or captions in this dataset yet</Empty.Title>
          <Empty.Description class="text-sm">Click "Add Files" or drag & drop files anywhere onto this page</Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {:else}
      <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {#each pendingUploads as entry (entry.id)}
          <UploadSkeletonCard
            {entry}
            onCancel={(id) => uploadQueue.cancel(id)}
            onRetry={(id) => uploadQueue.retry(id)}
          />
        {/each}
        {#each items as item (item.id)}
          <DatasetFileCard
            {item}
            {datasetName}
            onCaptionSave={handleCaptionSave}
            onMediaClick={(payload) => (activeLightboxItem = payload)}
          />
        {/each}
      </div>
    {/if}
  </div>
</RoutePage>

{#if activeLightboxItem}
  <div
    class="fixed inset-0 bg-black/85 z-[1000] flex items-center justify-center"
    onclick={() => (activeLightboxItem = null)}
    role="presentation"
  >
    {#if activeLightboxItem.kind === 'video'}
      {#if isPlayableInBrowser(activeLightboxItem.filename)}
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <video
          src={activeLightboxItem.url}
          controls
          autoplay
          class="max-w-[90vw] max-h-[90dvh] rounded-lg"
          onclick={(e) => e.stopPropagation()}
        >
          <track kind="captions" />
        </video>
      {:else}
        <div class="flex max-w-md flex-col items-center gap-3 rounded-lg bg-card p-8 text-center">
          <span class="text-lg font-semibold text-foreground">{activeLightboxItem.filename}</span>
          <span class="text-sm text-muted-foreground">
            Preview not available in browser — this format is supported for training.
          </span>
        </div>
      {/if}
    {:else}
      <img
        src={activeLightboxItem.url}
        alt={activeLightboxItem.filename}
        class="max-w-[90vw] max-h-[90dvh] object-contain rounded-lg"
      />
    {/if}
    <Button
      variant="ghost"
      size="icon"
      class="absolute top-4 right-4 bg-transparent border-none text-white cursor-pointer w-auto h-auto"
      onclick={() => (activeLightboxItem = null)}
    >
      <X size={24} />
    </Button>
  </div>
{/if}
