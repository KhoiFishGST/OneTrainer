<script lang="ts">
  import ResponsiveDialogDrawer from './ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input/index.js';

  let {
    open = true,
    title = 'Test Title',
    description = 'Test Description',
    onOpenChange = () => {},
    parentCount = 0,
    flush = false,
    withFooter = true
  } = $props<{
    open?: boolean;
    title?: string;
    description?: string;
    onOpenChange?: (open: boolean) => void;
    parentCount?: number;
    flush?: boolean;
    withFooter?: boolean;
  }>();

  let text = $state('draft content');
</script>

<Button id="trigger-btn">Open Trigger</Button>
<ResponsiveDialogDrawer
  {open}
  {title}
  {description}
  {onOpenChange}
  {flush}
  footer={withFooter ? footer : undefined}
>
  <div data-testid="content">
    <p>Parent count: {parentCount}</p>
    <Input data-testid="draft-input" value={text} onInput={(v) => text = v} />
  </div>
</ResponsiveDialogDrawer>

{#snippet footer()}
  <Button data-testid="footer-btn">Submit</Button>
{/snippet}
