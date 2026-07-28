<script lang="ts">
  import { FileText } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea as TextArea } from '$lib/components/ui/textarea/index.js';
  import * as Card from '$lib/components/ui/card/index.js';

  interface DatasetFileItem {
    id: string;
    image_name?: string;
    caption_name?: string;
    caption_content?: string;
  }

  let {
    item,
    datasetName,
    onCaptionSave = () => {},
    onImageClick = () => {},
  }: {
    item: DatasetFileItem;
    datasetName: string;
    onCaptionSave?: (captionName: string, content: string) => void;
    onImageClick?: (imageUrl: string) => void;
  } = $props();

  function handleImageClick() {
    if (item.image_name) {
      const url = `/api/datasets/image?dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.image_name)}`;
      onImageClick(url);
    }
  }

  function handleBlur(content: string) {
    const targetCaptionName = item.caption_name || `${item.id}.txt`;
    onCaptionSave(targetCaptionName, content);
  }
</script>

<Card.Root class="item-card">
  <Button
    variant="ghost"
    class="card-image-area"
    disabled={!item.image_name}
    onclick={handleImageClick}
  >
    {#if item.image_name}
      <img
        src="/api/datasets/image?dataset={encodeURIComponent(datasetName)}&filename={encodeURIComponent(item.image_name)}&thumb=true"
        alt={item.id}
        class="item-img"
      />
    {:else}
      <div class="no-image-placeholder">
        <FileText size={32} />
        <span>Text Only</span>
      </div>
    {/if}
  </Button>
  <Card.Content class="card-caption-area">
    <span class="item-id-label">{item.id}</span>
    <TextArea
      class="caption-textarea"
      placeholder="Add caption..."
      value={item.caption_content}
      onBlur={handleBlur}
    />
  </Card.Content>
</Card.Root>

<style>
  /* Bits UI boundary: style Card root component */
  :global(.item-card) {
    background: var(--card, #182026) !important;
    border: 1px solid var(--border, #2d3741) !important;
    border-radius: 8px !important;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    padding: 0 !important;
  }

  /* Bits UI boundary: style Card image Button component */
  :global(.card-image-area) {
    width: 100%;
    aspect-ratio: 1;
    background: #0f1419;
    cursor: pointer;
    border: none;
    padding: 0;
    display: block;
    text-align: left;
    border-radius: 0 !important;
  }

  /* Bits UI boundary: style Card image Button component disabled state */
  :global(.card-image-area:disabled) {
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
    color: var(--muted-foreground);
    gap: 0.5rem;
  }

  /* Bits UI boundary: style Card content component */
  :global(.card-caption-area) {
    padding: 0.75rem !important;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .item-id-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--muted-foreground);
  }

  /* Bits UI boundary: style TextArea child component */
  :global(.caption-textarea) {
    width: 100%;
    min-height: 60px;
    background: var(--muted, #14191f) !important;
    border: 1px solid var(--border, #2d3741) !important;
    border-radius: 4px !important;
    color: var(--foreground) !important;
    padding: 0.5rem !important;
    font-size: 0.8125rem !important;
    resize: vertical;
  }
</style>
