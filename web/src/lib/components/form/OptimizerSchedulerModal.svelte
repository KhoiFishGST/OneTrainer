<script lang="ts">
  import { untrack } from 'svelte';
  import ResponsiveDialogDrawer from '$lib/components/overlays/ResponsiveDialogDrawer.svelte';
  import { Button } from '$lib/components/ui/button';
  import Field from './Field.svelte';
  import { Switch as Toggle } from '../ui/switch/index.js';
  import { Input as TextInput } from '../ui/input/index.js';
  import NumberInput from './NumericDraftInput.svelte';
  import Select from './ValueSelect.svelte';
  import { getPath, setPath, cloneDocument } from '../../config/path';
  import type { SchemaField } from '../../config/validation';

  let {
    open = $bindable(false),
    title = 'Optimizer / Scheduler Parameters',
    fields = [],
    values = {},
    onSave = () => {},
    onClose = () => {},
  } = $props<{
    open: boolean;
    title?: string;
    fields?: SchemaField[];
    values?: Record<string, any>;
    onSave?: (updatedValues: Record<string, any>) => void | Promise<void>;
    onClose?: () => void;
  }>();

  let localValues = $state<Record<string, any>>({});
  let isSubmitting = $state(false);
  let submitError = $state<string | null>(null);

  $effect(() => {
    if (open) {
      untrack(() => {
        localValues = cloneDocument(values);
        submitError = null;
      });
    }
  });

  function normalizeControl(c?: string): 'toggle' | 'text' | 'number' | 'select' {
    if (c === 'toggle' || c === 'checkbox') return 'toggle';
    if (c === 'number' || c === 'range' || c === 'int' || c === 'float') return 'number';
    if (c === 'select') return 'select';
    return 'text';
  }

  async function handleSave() {
    submitError = null;
    isSubmitting = true;
    let finalValues = cloneDocument(localValues);
    for (const field of fields) {
      const primaryKey = field.keys?.[0] ?? field.id;
      const controlType = normalizeControl(field.control);
      if (controlType === 'number') {
        const currentVal = getPath(finalValues, primaryKey);
        if (typeof currentVal === 'string' && currentVal.trim() !== '') {
          const num = Number(currentVal.trim());
          if (!isNaN(num)) {
            finalValues = setPath(finalValues, primaryKey, num);
          }
        }
      }
    }
    try {
      await onSave(finalValues);
      open = false;
    } catch (err: any) {
      submitError = err?.message || 'Failed to save parameters';
    } finally {
      isSubmitting = false;
    }
  }

  function handleClose() {
    open = false;
    onClose?.();
  }

  function setValue(key: string, val: any) {
    localValues = setPath(localValues, key, val);
  }
</script>

<ResponsiveDialogDrawer
  bind:open
  onOpenChange={(v) => { if (!v) handleClose(); }}
  {title}
>
  {#if submitError}
    <div class="rounded-md bg-destructive/15 border border-destructive/30 p-3 text-sm text-destructive font-medium mb-3" role="alert">
      {submitError}
    </div>
  {/if}

  <form class="optimizer-scheduler-form" onsubmit={(e) => { e.preventDefault(); handleSave(); }}>
    {#each fields as field (field.id)}
      {@const primaryKey = field.keys?.[0] ?? field.id}
      {@const controlType = normalizeControl(field.control)}
      {@const fieldValue = getPath(localValues, primaryKey)}

      <Field id={field.id} label={field.label} tooltip={field.tooltip}>
        {#snippet children({ id, ariaDescribedBy })}
          {#if controlType === 'toggle'}
            <Toggle
              {id}
              value={Boolean(fieldValue)}
              {ariaDescribedBy}
              onChange={(val) => setValue(primaryKey, val)}
            />
          {:else if controlType === 'number'}
            <NumberInput
              {id}
              value={fieldValue}
              {ariaDescribedBy}
              onInput={(val) => setValue(primaryKey, val)}
            />
          {:else if controlType === 'select'}
            <Select
              {id}
              value={fieldValue}
              options={field.options || []}
              {ariaDescribedBy}
              onChange={(val) => setValue(primaryKey, val)}
            />
          {:else}
            <TextInput
              {id}
              value={fieldValue}
              {ariaDescribedBy}
              onInput={(val) => setValue(primaryKey, val)}
            />
          {/if}
        {/snippet}
      </Field>
    {/each}
  </form>
  {#snippet footer()}
    <div class="flex items-center justify-end gap-2 p-2">
      <Button variant="secondary" disabled={isSubmitting} onclick={handleClose}>Cancel</Button>
      <Button variant="default" disabled={isSubmitting} onclick={handleSave}>
        {isSubmitting ? 'Save...' : 'Save'}
      </Button>
    </div>
  {/snippet}
</ResponsiveDialogDrawer>

<style>
  .optimizer-scheduler-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
