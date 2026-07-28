<script lang="ts">
  import ResponsiveDialogDrawer from './ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input/index.js';

  let {
    open = true,
    title = 'Test Title',
    description = 'Test Description',
    onOpenChange = () => {},
    parentCount = 0
  } = $props<{
    open?: boolean;
    title?: string;
    description?: string;
    onOpenChange?: (open: boolean) => void;
    parentCount?: number;
  }>();

  let text = $state('draft content');
</script>

<Button id="trigger-btn">Open Trigger</Button>
<ResponsiveDialogDrawer {open} {title} {description} {onOpenChange}>
  <div data-testid="content">
    <p>Parent count: {parentCount}</p>
    <Input data-testid="draft-input" value={text} onInput={(v) => text = v} />
  </div>
  {#snippet footer()}
    <Button data-testid="footer-btn">Submit</Button>
  {/snippet}
</ResponsiveDialogDrawer>
