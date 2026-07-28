<script lang="ts">
  import { ArrowLeft, Upload, Image as ImageIcon, X } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
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
  class="detail-page"
  role="region"
  aria-label="Dataset Detail"
  ondragover={(e) => { e.preventDefault(); isDragging = true; }}
  ondragleave={() => (isDragging = false)}
  ondrop={handleDrop}
>
  {#if isDragging}
    <div class="dropzone-overlay">
      <Upload size={48} />
      <span>Drop images or caption files here to upload</span>
    </div>
  {/if}

  <div class="detail-header">
    <div class="header-left">
      <h1 class="dataset-title">{datasetName}</h1>
      {#if datasetPath}
        <span class="dataset-path">{datasetPath}</span>
      {/if}
      <a href="/datasets" class="btn-back">
        <ArrowLeft size={16} />
        <span>Back to Datasets</span>
      </a>
    </div>

    <Button variant="primary" class="btn-upload" onclick={() => fileInput?.open()}>
      <Upload size={18} />
      <span>Add Files</span>
    </Button>
    <FileInput
      bind:this={fileInput}
      multiple
      accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.txt,.caption"
      class="hidden-file-input"
      onChange={(files) => files && handleFileUpload(files)}
    />
  </div>

  {#if items.length === 0 && !loading}
    <Empty.Root class="empty-state">
      <Empty.Media>
        <ImageIcon size={48} />
      </Empty.Media>
      <Empty.Header>
        <Empty.Title class="empty-title">No images or captions in this dataset yet</Empty.Title>
        <Empty.Description class="empty-sub">Click "Add Files" or drag & drop files anywhere onto this page</Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <div class="items-grid">
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
  <div class="lightbox-overlay" onclick={() => (activeLightboxImage = null)} role="presentation">
    <img src={activeLightboxImage} alt="Preview" class="lightbox-img" />
    <Button variant="ghost" size="icon" class="btn-close-lightbox" onclick={() => (activeLightboxImage = null)}>
      <X size={24} />
    </Button>
  </div>
{/if}

<style>
  .detail-page {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    min-height: 100vh;
    position: relative;
  }

  .detail-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .btn-back {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--muted, #8995a1);
    text-decoration: none;
    font-size: 0.875rem;
    margin-top: 0.25rem;
    transition: color 0.15s ease;
  }

  .btn-back:hover {
    color: var(--text, #e6ebef);
  }

  .dataset-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-title, var(--accent, #3b82f6));
    margin: 0;
  }

  .dataset-path {
    font-size: 0.8125rem;
    color: var(--muted, #8995a1);
  }

  .detail-header :global(.btn-upload) {
    min-height: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--accent, #3b82f6);
    color: #ffffff;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
  }

  .detail-page :global(.hidden-file-input) {
    display: none;
  }

  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.25rem;
  }

  :global(.empty-state) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem !important;
    color: var(--muted) !important;
    gap: 0.75rem;
  }

  :global(.empty-title) {
    font-size: 1.125rem !important;
    font-weight: 600 !important;
    color: var(--text) !important;
  }

  :global(.empty-sub) {
    font-size: 0.875rem !important;
  }

  .dropzone-overlay {
    position: absolute;
    inset: 0;
    background: rgba(15, 23, 42, 0.9);
    border: 3px dashed var(--accent, #3b82f6);
    z-index: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    color: var(--accent);
  }

  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox-img {
    max-width: 90vw;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
  }

  .lightbox-overlay :global(.btn-close-lightbox) {
    min-height: 0;
    width: auto;
    height: auto;
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    color: #ffffff;
    cursor: pointer;
  }
</style>
