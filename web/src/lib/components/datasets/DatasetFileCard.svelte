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

<Card.Root class="overflow-hidden flex flex-col p-0 bg-card border border-border rounded-lg">
  <Button
    variant="ghost"
    class="w-full aspect-square bg-slate-950 p-0 rounded-none h-auto text-left disabled:cursor-default"
    disabled={!item.image_name}
    onclick={handleImageClick}
  >
    {#if item.image_name}
      <img
        src="/api/datasets/image?dataset={encodeURIComponent(datasetName)}&filename={encodeURIComponent(item.image_name)}&thumb=true"
        alt={item.id}
        class="w-full h-full object-cover"
      />
    {:else}
      <div class="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <FileText size={32} />
        <span>Text Only</span>
      </div>
    {/if}
  </Button>
  <Card.Content class="p-3 flex flex-col gap-2">
    <span class="text-xs font-semibold text-muted-foreground">{item.id}</span>
    <TextArea
      class="w-full min-h-[60px] bg-muted border border-border rounded text-xs p-2 text-foreground resize-y"
      placeholder="Add caption..."
      value={item.caption_content}
      onBlur={handleBlur}
    />
  </Card.Content>
</Card.Root>
