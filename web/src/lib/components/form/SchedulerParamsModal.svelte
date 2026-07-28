<script lang="ts">
  import { untrack } from 'svelte';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';

  let {
    open = $bindable(false),
    values = {},
    onSave = () => {},
  } = $props<{
    open: boolean;
    values?: Record<string, any>;
    onSave?: (updatedValues: Record<string, any>) => void;
  }>();

  let customClassName = $state('');
  let wasOpen = $state(false);
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  $effect(() => {
    if (open && !wasOpen) {
      untrack(() => {
        customClassName = values?.custom_learning_rate_scheduler || '';
      });
    }
    wasOpen = open;
  });

  async function handleApply() {
    submitError = null;
    isSubmitting = true;
    try {
      await onSave({
        custom_learning_rate_scheduler: customClassName,
      });
      open = false;
    } catch (err: any) {
      submitError = err?.message || 'Failed to save scheduler parameters';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<ResponsiveDialogDrawer
  bind:open
  onOpenChange={(v) => { if (!v) open = false; }}
  title="Configure Custom Scheduler Parameters"
>
  <div class="scheduler-modal-body">
    {#if submitError}
      <div class="rounded-md bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive font-medium" role="alert">
        {submitError}
      </div>
    {/if}

    <div class="field-item">
      <label for="custom-scheduler-class" class="field-label">
        Class Name
      </label>
      <TextInput
        id="custom-scheduler-class"
        class="w-full"
        placeholder="e.g. torch.optim.lr_scheduler.CosineAnnealingLR"
        value={customClassName}
        onInput={(val) => (customClassName = val)}
      />
      <span class="field-help">
        Python class module and name for the custom scheduler class in the form of <code>&lt;module&gt;.&lt;class_name&gt;</code>.
      </span>
    </div>
  </div>
  {#snippet footer()}
    <div class="flex items-center justify-end gap-2 p-2">
      <Button variant="secondary" disabled={isSubmitting} onclick={() => (open = false)}>Cancel</Button>
      <Button variant="default" disabled={isSubmitting} onclick={handleApply}>
        {isSubmitting ? 'Applying...' : 'Apply Parameters'}
      </Button>
    </div>
  {/snippet}
</ResponsiveDialogDrawer>

<style>
  .scheduler-modal-body {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .field-help {
    font-size: 0.75rem;
    color: var(--muted-foreground);

    & code {
      background: var(--muted, rgba(255, 255, 255, 0.05));
      padding: 0.1rem 0.3rem;
      border-radius: 3px;
    }
  }
</style>
