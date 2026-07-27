<script lang="ts">
  import type { SchemaField, SchemaTab } from '../../config/validation';
  import type { FieldError } from '../../api/types';
  import { getPath } from '../../config/path';
  import Field from './Field.svelte';
  import Toggle from './Toggle.svelte';
  import TextInput from './TextInput.svelte';
  import NumberInput from './NumberInput.svelte';
  import Select from './Select.svelte';
  import DirectoryInput from './DirectoryInput.svelte';
  import TimeInput from './TimeInput.svelte';

  import FormPanel from './FormPanel.svelte';

  export type ControlType = 'toggle' | 'text' | 'number' | 'select' | 'directory' | 'time';

  let {
    tab,
    values = {},
    issues = [],
    setRaw,
    openDirectory,
    activeSubTab,
    hideGroupTitle = false,
  }: {
    tab?: SchemaTab;
    values?: Record<string, any>;
    issues?: FieldError[];
    setRaw: (path: string, val: any) => void;
    openDirectory?: (path: string, onSelect?: (selectedPath: string) => void) => void;
    activeSubTab?: string;
    hideGroupTitle?: boolean;
  } = $props();

  function normalizeControl(control?: string): ControlType {
    const norm = (control || 'text').toLowerCase();
    if (['toggle', 'checkbox', 'bool', 'boolean'].includes(norm)) return 'toggle';
    if (['text', 'string'].includes(norm)) return 'text';
    if (['number', 'integer', 'int', 'float', 'double'].includes(norm)) return 'number';
    if (['select', 'dropdown', 'enum'].includes(norm)) return 'select';
    if (['directory', 'dir', 'path', 'file'].includes(norm)) return 'directory';
    if (['time', 'duration'].includes(norm)) return 'time';

    throw new Error(`Unknown control type: "${control}"`);
  }

  function getFieldError(field: SchemaField): string | undefined {
    if (!issues || issues.length === 0) return undefined;
    const keys = field.keys || [field.id];
    const match = issues.find((issue) => keys.includes(issue.path) || issue.path === field.id);
    return match?.message;
  }

  function getFieldValue(field: SchemaField, keyIndex = 0): any {
    const key = field.keys?.[keyIndex] ?? field.id;
    return getPath(values, key);
  }

  function isGroupInSubTab(groupId: string, subTab?: string): boolean {
    if (!subTab) return true;
    switch (subTab) {
      case 'base':
        return groupId === 'base_settings';
      case 'execution':
        return groupId === 'execution' || groupId === 'execution_hardware';
      case 'text':
        return (
          ['text_encoders', 'embeddings'].includes(groupId) ||
          groupId.startsWith('text_encoder')
        );
      case 'denoise':
        return groupId === 'denoising_model';
      case 'layer':
        return groupId === 'layer_filtering';
      case 'noise':
        return groupId === 'noise_and_timesteps';
      case 'masking':
        return groupId === 'masking_and_conditioning';
      case 'loss':
        return groupId === 'loss';
      // General route subtabs:
      case 'workspace':
        return groupId === 'workspace';
      case 'debug':
        return groupId === 'debug';
      case 'tensors':
        return groupId === 'tensorboard' || groupId === 'validation';
      case 'hardware':
        return groupId === 'execution_hardware' || groupId === 'multi_gpu';
      // Model route subtabs:
      case 'model':
        return groupId === 'base_model' || groupId === 'primary_backbone';
      case 'output':
        return groupId === 'output';
      case 'quant':
        return groupId === 'quantization';
      case 'vae':
        return groupId === 'vae_autoencoders';
      // Fallback for legacy subtab IDs if any:
      case 'general_opt':
        return ['base_settings', 'execution'].includes(groupId);
      case 'components':
        return (
          ['denoising_model', 'text_encoders', 'embeddings', 'layer_filtering'].includes(groupId) ||
          groupId.startsWith('text_encoder')
        );
      case 'noise_loss':
        return ['noise_and_timesteps', 'loss', 'masking_and_conditioning'].includes(groupId);
      default:
        return true;
    }
  }
</script>

{#snippet renderGroup(group: any)}
  {@const visibleFields = (group.fields || []).filter((f: any) => f.visible !== false)}

  <FormPanel title={group.title || group.label} isComponentsGroup={group.id === 'model_components'} hideTitle={hideGroupTitle}>
    {#if visibleFields.length > 0}
      <div class="group-fields" class:components-table={group.id === 'model_components'}>
        {#each visibleFields as field (field.id)}
          {@const controlType = normalizeControl(field.control)}
          {@const primaryKey = field.keys?.[0] ?? field.id}
          {@const error = getFieldError(field)}
          {@const fieldValue = getFieldValue(field, 0)}
          {@const isFullWidth = ['base_model_name', 'model_type', 'output_model_destination'].includes(primaryKey)}

          <Field
            id={field.id}
            label={field.label}
            tooltip={field.tooltip}
            {error}
            inline={false}
            fullWidth={isFullWidth}
          >
            {#snippet children({ id, ariaDescribedBy })}
              {#if controlType === 'toggle'}
                <Toggle
                  {id}
                  value={fieldValue}
                  {ariaDescribedBy}
                  onChange={(val) => setRaw(primaryKey, val)}
                />
              {:else if controlType === 'text'}
                <TextInput
                  {id}
                  value={fieldValue}
                  {ariaDescribedBy}
                  onInput={(val) => setRaw(primaryKey, val)}
                />
              {:else if controlType === 'number'}
                <NumberInput
                  {id}
                  value={fieldValue}
                  {ariaDescribedBy}
                  onInput={(val) => setRaw(primaryKey, val)}
                />
              {:else if controlType === 'select'}
                <Select
                  {id}
                  value={fieldValue}
                  options={field.options || []}
                  {ariaDescribedBy}
                  onChange={(val) => setRaw(primaryKey, val)}
                />
              {:else if controlType === 'directory'}
                <DirectoryInput
                  {id}
                  value={fieldValue}
                  {ariaDescribedBy}
                  onInput={(val) => setRaw(primaryKey, val)}
                  onOpenDirectory={openDirectory ? (path, cb) => openDirectory(path, cb ?? ((s) => setRaw(primaryKey, s))) : undefined}
                />
              {:else if controlType === 'time'}
                {@const unitKey = field.keys?.[1] ?? `${primaryKey}_unit`}
                {@const unitValue = getFieldValue(field, 1) ?? 'MINUTE'}
                <TimeInput
                  {id}
                  value={fieldValue}
                  unit={unitValue}
                  unitOptions={field.options}
                  {ariaDescribedBy}
                  onValueInput={(val) => setRaw(primaryKey, val)}
                  onUnitChange={(unit) => setRaw(unitKey, unit)}
                />
              {/if}
            {/snippet}
          </Field>
        {/each}
      </div>
    {/if}
  </FormPanel>
{/snippet}

<div class="schema-form" class:is-training-tab={tab?.id === 'training' && !activeSubTab}>
  {#if tab?.groups}
    {#if activeSubTab}
      {#each tab.groups.filter((g) => isGroupInSubTab(g.id, activeSubTab)) as group (group.id)}
        {@render renderGroup(group)}
      {/each}
    {:else if tab.id === 'training'}
      <div class="training-column col-1">
        {#each tab.groups.filter((g) => ['base_settings', 'text_encoders', 'embeddings'].includes(g.id)) as group (group.id)}
          {@render renderGroup(group)}
        {/each}
      </div>
      <div class="training-column col-2">
        {#each tab.groups.filter((g) => ['execution', 'denoising_model', 'noise_and_timesteps'].includes(g.id)) as group (group.id)}
          {@render renderGroup(group)}
        {/each}
      </div>
      <div class="training-column col-3">
        {#each tab.groups.filter((g) => ['masking_and_conditioning', 'loss', 'layer_filtering'].includes(g.id)) as group (group.id)}
          {@render renderGroup(group)}
        {/each}
      </div>
    {:else}
      {#each tab.groups as group (group.id)}
        {@render renderGroup(group)}
      {/each}
    {/if}
  {/if}
</div>

<style>
  .schema-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    width: 740px;
    max-width: 100%;
  }

  .schema-form.is-training-tab {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
    max-width: 100%;
    align-items: start;
  }

  .training-column {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  @media (max-width: 1280px) {
    .schema-form.is-training-tab {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 1024px) {
    .schema-form.is-training-tab {
      grid-template-columns: 1fr;
    }
  }

  .form-group {
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 8px;
    padding: 1.25rem;
    background: var(--color-bg-card, var(--panel, #181e25));
  }

  .group-title {
    font-size: 1rem;
    font-weight: 600;
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .group-fields {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    width: 100%;
  }

  .group-fields.components-table {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    align-items: stretch;
    width: 100%;
  }

  .group-fields.components-table :global(.form-field) {
    width: 100%;
    flex: 1 1 100%;
  }

  .group-fields.components-table :global(.select-input),
  .group-fields.components-table :global(.text-input),
  .group-fields.components-table :global(.number-input),
  .group-fields.components-table :global(.directory-input-wrapper) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box;
  }

  .options-section {
    margin-top: 1rem;
    padding: 0.875rem 1rem;
    border: 1px solid var(--color-border, var(--line, #2d3741));
    border-radius: 6px;
    background: var(--color-bg-secondary, var(--panel-raised, #13181f));
  }

  .group-fields + .options-section {
    margin-top: 1.25rem;
  }

  .options-header {
    margin-bottom: 0.625rem;
  }

  .options-title {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, var(--muted, #8995a1));
  }

  .options-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: flex-end;
  }
</style>
