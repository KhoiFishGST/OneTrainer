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

<div class="schema-form">
  {#if tab?.groups}
    {#each tab.groups as group (group.id)}
      <section class="form-group">
        {#if group.title || group.label}
          <h3 class="group-title">{group.title || group.label}</h3>
        {/if}
        <div class="group-fields">
          {#each group.fields || [] as field (field.id)}
            {#if field.visible !== false}
              {@const controlType = normalizeControl(field.control)}
              {@const primaryKey = field.keys?.[0] ?? field.id}
              {@const error = getFieldError(field)}
              {@const fieldValue = getFieldValue(field, 0)}

              <Field
                id={field.id}
                label={field.label}
                tooltip={field.tooltip}
                {error}
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
            {/if}
          {/each}
        </div>
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
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
