<script lang="ts">
  import ResponsiveDialogDrawer from './ResponsiveDialogDrawer.svelte';

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

<button id="trigger-btn">Open Trigger</button>
<ResponsiveDialogDrawer {open} {title} {description} {onOpenChange}>
  <div data-testid="content">
    <p>Parent count: {parentCount}</p>
    <input data-testid="draft-input" bind:value={text} />
  </div>
  {#snippet footer()}
    <button data-testid="footer-btn">Submit</button>
  {/snippet}
</ResponsiveDialogDrawer>
