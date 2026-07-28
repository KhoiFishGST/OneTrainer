<script lang="ts">
  import type { Concept } from '$lib/api/types';
  import Field from '$lib/components/form/Field.svelte';
  import { Input as TextInput } from '$lib/components/ui/input/index.js';
  import NumberInput from '$lib/components/form/NumericDraftInput.svelte';
  import { Switch as Toggle } from '$lib/components/ui/switch/index.js';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import DirectoryInput from '$lib/components/form/DirectoryInput.svelte';
  import { Button } from '$lib/components/ui/button';
  import { FolderOpen, FolderKanban } from 'lucide-svelte';

  let {
    draft = $bindable(),
    onBrowsePath,
    onOpenDatasetPicker,
  }: {
    draft: Concept;
    onBrowsePath: (mode: 'dir' | 'file', target: 'concept' | 'prompt' | 'special_tags', currentPath: string) => void;
    onOpenDatasetPicker: () => void;
  } = $props();
</script>

<div class="form-stack">
  <Field id="concept-name" label="Name" tooltip="Name of the concept">
    {#snippet children({ id, ariaDescribedBy })}
      <TextInput
        {id}
        value={draft.name || ''}
        {ariaDescribedBy}
        onInput={(val) => {
          draft.name = val;
        }}
        placeholder="e.g. MyCharacter"
      />
    {/snippet}
  </Field>

  <Field id="concept-enabled" label="Enabled" tooltip="Enable or disable this concept">
    {#snippet children({ id, ariaDescribedBy })}
      <Toggle
        {id}
        value={draft.enabled !== false}
        {ariaDescribedBy}
        onChange={(val) => {
          draft.enabled = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="concept-type"
    label="Concept Type"
    tooltip="STANDARD: Standard finetuning with sample as training target. VALIDATION: Use concept for validation instead of training. PRIOR_PREDICTION: Use sample to make a prediction using prior model as training target."
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Select
        {id}
        value={draft.type || 'STANDARD'}
        options={[
          { value: 'STANDARD', label: 'STANDARD (Finetune training target)' },
          { value: 'VALIDATION', label: 'VALIDATION (Validation dataset)' },
          {
            value: 'PRIOR_PREDICTION',
            label: 'PRIOR_PREDICTION (Prior preservation regularization)',
          },
        ]}
        {ariaDescribedBy}
        onChange={(v) => {
          draft.type = v as any;
        }}
      />
    {/snippet}
  </Field>

  <Field id="concept-path" label="Path" tooltip="Path where the training data is located">
    {#snippet children({ id, ariaDescribedBy })}
      <div class="path-field-stack">
        <TextInput
          {id}
          value={draft.path || ''}
          {ariaDescribedBy}
          onInput={(val) => {
            draft.path = val;
          }}
          placeholder="/path/to/dataset/images"
        />
        <div class="path-action-row">
          <label
            class="subdir-toggle-inline"
            title="Includes images from subdirectories into the dataset"
          >
            <Toggle
              id="concept-subdirs-inline"
              value={draft.include_subdirectories ?? false}
              onChange={(val) => {
                draft.include_subdirectories = val;
              }}
            />
            <span>Subdirectories</span>
          </label>
          <Button
            type="button"
            class="btn-path-action"
            onclick={() => onBrowsePath('dir', 'concept', draft.path || '')}
          >
            <FolderOpen size={16} />
            <span>Browse</span>
          </Button>
          <Button
            type="button"
            class="btn-path-action btn-accent-action"
            onclick={onOpenDatasetPicker}
          >
            <FolderKanban size={16} />
            <span>Datasets</span>
          </Button>
        </div>
      </div>
    {/snippet}
  </Field>

  {#if draft.text}
    <Field
      id="concept-prompt-source"
      label="Prompt Source"
      tooltip="The source for prompts used during training. When selecting 'From single text file', specify prompt file path below."
    >
      {#snippet children({ id, ariaDescribedBy })}
        <Select
          {id}
          value={draft.text?.prompt_source || 'sample'}
          options={[
            { value: 'sample', label: 'From text file per sample (.txt / .caption)' },
            { value: 'concept', label: 'From single text file' },
            { value: 'filename', label: 'From image file name' },
          ]}
          {ariaDescribedBy}
          onChange={(v) => {
            if (draft.text) draft.text.prompt_source = v;
          }}
        />
      {/snippet}
    </Field>

    {#if draft.text?.prompt_source === 'concept'}
      <Field
        id="concept-prompt-path"
        label="Prompt Path"
        tooltip="Path to single text file containing training prompts"
      >
        {#snippet children({ id, ariaDescribedBy })}
          <DirectoryInput
            {id}
            value={draft.text?.prompt_path || ''}
            {ariaDescribedBy}
            buttonLabel="Browse"
            onInput={(val) => {
              if (draft.text) draft.text.prompt_path = val;
            }}
            onOpenDirectory={(curr) => onBrowsePath('file', 'prompt', curr)}
            placeholder="/path/to/prompts.txt"
          />
        {/snippet}
      </Field>
    {/if}
  {/if}

  <Field
    id="concept-img-variations"
    label="Image Variations"
    tooltip="The number of different image versions to cache if latent caching is enabled."
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={draft.image_variations ?? 1}
        {ariaDescribedBy}
        onInput={(val) => {
          (draft.image_variations as any) = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="concept-text-variations"
    label="Text Variations"
    tooltip="The number of different text versions to cache if latent caching is enabled."
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={draft.text_variations ?? 1}
        {ariaDescribedBy}
        onInput={(val) => {
          (draft.text_variations as any) = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="concept-balancing-strategy"
    label="Balancing Strategy"
    tooltip="Use REPEATS to multiply concept, or SAMPLES to specify exact target count"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <Select
        {id}
        value={draft.balancing_strategy || 'REPEATS'}
        options={[
          { value: 'REPEATS', label: 'REPEATS (Multiply dataset epoch count)' },
          { value: 'SAMPLES', label: 'SAMPLES (Exact sample target count)' },
        ]}
        {ariaDescribedBy}
        onChange={(v) => {
          draft.balancing_strategy = v as 'REPEATS' | 'SAMPLES';
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="concept-balancing"
    label="Balancing Value"
    tooltip="The number of samples/repeats used during training"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={draft.balancing ?? 1.0}
        {ariaDescribedBy}
        onInput={(val) => {
          (draft.balancing as any) = val;
        }}
      />
    {/snippet}
  </Field>

  <Field
    id="concept-loss-weight"
    label="Loss Weight"
    tooltip="The loss multiplier for this concept"
  >
    {#snippet children({ id, ariaDescribedBy })}
      <NumberInput
        {id}
        value={draft.loss_weight ?? 1.0}
        {ariaDescribedBy}
        onInput={(val) => {
          (draft.loss_weight as any) = val;
        }}
      />
    {/snippet}
  </Field>
</div>

<style>
  .form-stack {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    width: 100%;
  }

  .path-field-stack {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }

  .path-action-row {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    width: 100%;
  }

  .subdir-toggle-inline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-right: auto;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--color-text, var(--text, #e6ebef));
    cursor: pointer;
  }

  .path-action-row :global(.btn-path-action) {
    min-height: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    height: 38px;
    padding: 0 0.875rem;
    background: var(--color-bg-button, var(--control, #14191f));
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    color: var(--color-text, var(--text, #e6ebef));
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    box-sizing: border-box;
    white-space: nowrap;
    transition: all 0.15s ease;
  }

  .path-action-row :global(.btn-path-action:hover) {
    background: var(--color-bg-button-hover, var(--panel-raised, #1d242c));
    border-color: var(--color-primary, var(--accent, #3b82f6));
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .path-action-row :global(.btn-path-action.btn-accent-action) {
    color: var(--color-text-title, var(--accent, #3b82f6));
  }
</style>
