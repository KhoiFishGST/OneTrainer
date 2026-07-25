<script lang="ts">
  import { ArrowLeft, Upload, Image as ImageIcon, FileText, Trash2, X } from 'lucide-svelte';
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
  let fileInput = $state<HTMLInputElement | null>(null);
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
    <a href="/data" class="btn-back">
      <ArrowLeft size={16} />
      <span>Back to Data</span>
    </a>
    <div class="header-info">
      <h1 class="dataset-title">{datasetName}</h1>
      <span class="dataset-path">{datasetPath}</span>
    </div>
    <button type="button" class="btn-upload" onclick={() => fileInput?.click()}>
      <Upload size={18} />
      <span>Add Files</span>
    </button>
    <input
      bind:this={fileInput}
      type="file"
      multiple
      accept="image/*,.jpg,.jpeg,.png,.webp,.bmp,.gif,.tiff,.txt,.caption"
      class="hidden-file-input"
      onchange={(e) => {
        const target = e.target as HTMLInputElement;
        if (target.files) handleFileUpload(target.files);
      }}
    />
  </div>

  {#if items.length === 0 && !loading}
    <div class="empty-state">
      <ImageIcon size={48} />
      <p class="empty-title">No images or captions in this dataset yet</p>
      <p class="empty-sub">Click "Add Files" or drag & drop files anywhere onto this page</p>
    </div>
  {:else}
    <div class="items-grid">
      {#each items as item}
        <div class="item-card">
          <button
            type="button"
            class="card-image-area"
            disabled={!item.image_name}
            onclick={() => {
              if (item.image_name) {
                activeLightboxImage = `/api/datasets/image?dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.image_name)}`;
              }
            }}
          >
            {#if item.image_name}
              <img
                src="/api/datasets/image?dataset={encodeURIComponent(datasetName)}&filename={encodeURIComponent(item.image_name)}"
                alt={item.id}
                class="item-img"
              />
            {:else}
              <div class="no-image-placeholder">
                <FileText size={32} />
                <span>Text Only</span>
              </div>
            {/if}
          </button>
          <div class="card-caption-area">
            <span class="item-id-label">{item.id}</span>
            <textarea
              class="caption-textarea"
              placeholder="Add caption..."
              value={item.caption_content}
              onblur={(e) => handleCaptionSave(item.caption_name || `${item.id}.txt`, (e.target as HTMLTextAreaElement).value)}
            ></textarea>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

{#if activeLightboxImage}
  <div class="lightbox-overlay" onclick={() => (activeLightboxImage = null)} role="presentation">
    <img src={activeLightboxImage} alt="Preview" class="lightbox-img" />
    <button type="button" class="btn-close-lightbox" onclick={() => (activeLightboxImage = null)}>
      <X size={24} />
    </button>
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
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .btn-back {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--muted);
    text-decoration: none;
    font-size: 0.875rem;
  }
  .btn-back:hover {
    color: var(--text);
  }
  .dataset-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text-title, var(--accent, #3b82f6));
    margin: 0;
  }
  .dataset-path {
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .btn-upload {
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
  .hidden-file-input {
    display: none;
  }
  .items-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 1.25rem;
  }
  .item-card {
    background: var(--panel, #182026);
    border: 1px solid var(--line, #2d3741);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .card-image-area {
    width: 100%;
    aspect-ratio: 1;
    background: #0f1419;
    cursor: pointer;
    border: none;
    padding: 0;
    display: block;
    text-align: left;
  }
  .card-image-area:disabled {
    cursor: default;
  }
  .item-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .no-image-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--muted);
    gap: 0.5rem;
  }
  .card-caption-area {
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .item-id-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted);
  }
  .caption-textarea {
    width: 100%;
    min-height: 60px;
    background: var(--control, #14191f);
    border: 1px solid var(--line, #2d3741);
    border-radius: 4px;
    color: var(--text);
    padding: 0.5rem;
    font-size: 0.8125rem;
    resize: vertical;
  }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: var(--muted);
    gap: 0.75rem;
  }
  .empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text);
  }
  .empty-sub {
    font-size: 0.875rem;
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
  .btn-close-lightbox {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: transparent;
    border: none;
    color: #ffffff;
    cursor: pointer;
  }
</style>
