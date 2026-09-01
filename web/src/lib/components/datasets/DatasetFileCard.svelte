<script lang="ts">
  import { FileText, Play } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Textarea as TextArea } from '$lib/components/ui/textarea/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import type { MediaKind } from '$lib/upload/media-kind';

  interface DatasetFileItem {
    id: string;
    kind: MediaKind;
    media_name?: string | null;
    caption_name?: string | null;
    caption_content?: string;
  }

  let {
    item,
    datasetName,
    onCaptionSave = () => {},
    onMediaClick = () => {},
  }: {
    item: DatasetFileItem;
    datasetName: string;
    onCaptionSave?: (captionName: string, content: string) => void;
    onMediaClick?: (payload: { url: string; kind: MediaKind; filename: string }) => void;
  } = $props();

  let hasMedia = $derived(Boolean(item.media_name));

  let posterUrl = $derived(
    item.media_name
      ? `/api/datasets/image?dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.media_name)}&thumb=true`
      : ''
  );

  function handleMediaClick() {
    if (!item.media_name) return;
    const params = `dataset=${encodeURIComponent(datasetName)}&filename=${encodeURIComponent(item.media_name)}`;
    const url =
      item.kind === 'video'
        ? `/api/datasets/video?${params}`
        : `/api/datasets/image?${params}`;
    onMediaClick({ url, kind: item.kind, filename: item.media_name });
  }

  function handleBlur(content: string) {
    const targetCaptionName = item.caption_name || `${item.id}.txt`;
    onCaptionSave(targetCaptionName, content);
  }
</script>

<Card.Root class="overflow-hidden flex flex-col p-0 bg-card border border-border rounded-lg">
  <Button
    variant="ghost"
    class="w-full aspect-square bg-slate-950 p-0 rounded-none h-auto text-left disabled:cursor-default relative"
    disabled={!hasMedia}
    onclick={handleMediaClick}
  >
    {#if hasMedia}
      <img src={posterUrl} alt={item.id} class="w-full h-full object-cover" />
      {#if item.kind === 'video'}
        <span
          aria-label="Play video"
          class="absolute inset-0 flex items-center justify-center bg-black/25"
        >
          <span class="flex size-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play size={24} />
          </span>
        </span>
      {/if}
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
