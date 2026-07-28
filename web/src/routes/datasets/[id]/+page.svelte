<script lang="ts">
  import { ArrowLeft, Upload, Image as ImageIcon, X } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { FileInput } from '$lib/components/ui/file-input/index.js';
  import * as Empty from '$lib/components/ui/empty/index.js';
  import DatasetFileCard from '$lib/components/datasets/DatasetFileCard.svelte';
  import {
    createDatasetFilesQuery,
    createUploadDatasetFilesMutation,
    createUpdateCaptionMutation,
  } from '$lib/api/queries';

  let { data } = $props<{ data: { id: string } }>();
  let datasetName = $derived(data.id);

  // svelte-ignore state_referenced_locally
  const filesQuery = createDatasetFilesQuery(data.id);
  const uploadMutation = createUploadDatasetFilesMutation();
  const captionMutation = createUpdateCaptionMutation();

  let items = $derived($filesQuery.data?.items || []);
  let datasetPath = $derived($filesQuery.data?.path || '');
  let loading = $derived($filesQuery.isLoading);
  let fileInput = $state<{ open: () => void } | null>(null);
  let isDragging = $state(false);
  let activeLightboxImage = $state<string | null>(null);

  async function handleFileUpload(files: FileList | File[]) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }
    try {
      await $uploadMutation.mutateAsync({ name: datasetName, formData });
    } catch (err) {
      console.error('Upload failed', err);
    }
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

  function handleImageClick(imageUrl: string) {
    activeLightboxImage = imageUrl;
  }
</script>

<div
  class="p-6 flex flex-col gap-6 min-h-screen relative"
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
      {#if datasetPath}
        <span class="text-xs text-muted-foreground">{datasetPath}</span>
      {/if}
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
      accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.txt,.caption"
      class="hidden"
      onChange={(files) => files && handleFileUpload(files)}
    />
  </div>

  {#if items.length === 0 && !loading}
    <Empty.Root class="flex flex-col items-center justify-center p-16 text-muted-foreground gap-3">
      <Empty.Media>
        <ImageIcon size={48} />
      </Empty.Media>
      <Empty.Header>
        <Empty.Title class="text-lg font-semibold text-foreground">No images or captions in this dataset yet</Empty.Title>
        <Empty.Description class="text-sm">Click "Add Files" or drag & drop files anywhere onto this page</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
      {#each items as item (item.id)}
        <DatasetFileCard
          {item}
          {datasetName}
          onCaptionSave={handleCaptionSave}
          onImageClick={handleImageClick}
        />
      {/each}
    </div>
  {/if}
</div>

{#if activeLightboxImage}
  <div class="fixed inset-0 bg-black/85 z-[1000] flex items-center justify-center" onclick={() => (activeLightboxImage = null)} role="presentation">
    <img src={activeLightboxImage} alt="Preview" class="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" />
    <Button variant="ghost" size="icon" class="absolute top-4 right-4 bg-transparent border-none text-white cursor-pointer w-auto h-auto" onclick={() => (activeLightboxImage = null)}>
      <X size={24} />
    </Button>
  </div>
{/if}
