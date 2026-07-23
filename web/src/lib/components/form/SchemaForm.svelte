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

  export type ControlType = 'toggle' | 'text' | 'number' | 'select' | 'directory' | 'time';

  let {
    tab,
    values = {},
    issues = [],
    setRaw,
    openDirectory,
  }: {
    tab?: SchemaTab;
    values?: Record<string, any>;
    issues?: FieldError[];
    setRaw: (path: string, val: any) => void;
    openDirectory?: (path: string, onSelect?: (selectedPath: string) => void) => void;
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
</script>

<div class="schema-form" class:is-model-tab={tab?.id === 'model'}>
  {#if tab?.groups}
    {#each tab.groups as group (group.id)}
      {@const visibleFields = (group.fields || []).filter((f) => f.visible !== false)}
      {@const inputFields = visibleFields.filter((f) => normalizeControl(f.control) !== 'toggle')}
      {@const toggleFields = visibleFields.filter((f) => normalizeControl(f.control) === 'toggle')}

      <section class="form-group" class:is-components-group={group.id === 'model_components'}>
        {#if group.title || group.label}
          <h3 class="group-title">{group.title || group.label}</h3>
        {/if}

        {#if inputFields.length > 0}
          <div class="group-fields" class:components-table={group.id === 'model_components'}>
            {#each inputFields as field (field.id)}
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
                  {#if controlType === 'text'}
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
                    {@const unitValue = getFieldValue(field, 1) ?? 'seconds'}
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

        {#if toggleFields.length > 0}
          <div class="options-section">
            <div class="options-header">
              <span class="options-title">Options & Features</span>
            </div>
            <div class="options-grid">
              {#each toggleFields as field (field.id)}
                {@const primaryKey = field.keys?.[0] ?? field.id}
                {@const error = getFieldError(field)}
                {@const fieldValue = getFieldValue(field, 0)}

                <Field
                  id={field.id}
                  label={field.label}
                  tooltip={field.tooltip}
                  {error}
                  inline={true}
                >
                  {#snippet children({ id, ariaDescribedBy })}
                    <Toggle
                      {id}
                      value={fieldValue}
                      {ariaDescribedBy}
                      onChange={(val) => setRaw(primaryKey, val)}
                    />
                  {/snippet}
                </Field>
              {/each}
            </div>
          </div>
        {/if}
      </section>
    {/each}
  {/if}
</div>

<style>
  .schema-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .schema-form.is-model-tab {
    display: grid;
    grid-template-columns: calc(65% - 0.75rem) calc(35% - 0.75rem);
    gap: 1.5rem;
    align-items: start;
  }

  @media (max-width: 1024px) {
    .schema-form.is-model-tab {
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
    color: var(--color-text-title, var(--text, #e6ebef));
  }

  .group-fields {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    align-items: flex-end;
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
