<script lang="ts">
  import { HelpCircle } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    id,
    label,
    tooltip,
    error,
    inline = false,
    children,
  }: {
    id: string;
    label?: string;
    tooltip?: string;
    error?: string;
    inline?: boolean;
    children?: Snippet<[{ id: string; ariaDescribedBy?: string }]>;
  } = $props();

  let showTooltip = $state(false);

  const inputId = $derived(`field-${id}`);
  const errorId = $derived(error ? `${inputId}-error` : undefined);
  const tooltipId = $derived(tooltip ? `${inputId}-tooltip` : undefined);

  const ariaDescribedBy = $derived(
    [errorId, showTooltip ? tooltipId : undefined].filter(Boolean).join(' ') || undefined
  );
</script>

<div class="form-field" class:is-inline={inline} class:has-error={!!error}>
  {#if inline}
    <div class="inline-row">
      <div class="field-control">
        {#if children}
          {@render children({ id: inputId, ariaDescribedBy })}
        {/if}
      </div>
      {#if label}
        <label for={inputId} class="field-label inline-label">{label}</label>
      {/if}
      {#if tooltip}
        <button
          type="button"
          class="tooltip-trigger"
          aria-label={`Help for ${label}`}
          aria-expanded={showTooltip}
          onclick={() => (showTooltip = !showTooltip)}
        >
          <HelpCircle size={14} />
        </button>
      {/if}
    </div>
  {:else}
    {#if label}
      <div class="field-label-row">
        <label for={inputId} class="field-label">{label}</label>
        {#if tooltip}
          <button
            type="button"
            class="tooltip-trigger"
            aria-label={`Help for ${label}`}
            aria-expanded={showTooltip}
            onclick={() => (showTooltip = !showTooltip)}
          >
            <HelpCircle size={14} />
          </button>
        {/if}
      </div>
    {/if}

    <div class="field-control">
      {#if children}
        {@render children({ id: inputId, ariaDescribedBy })}
      {/if}
    </div>
  {/if}

  {#if tooltip && showTooltip}
    <div id={tooltipId} class="field-tooltip" role="tooltip">
      {tooltip}
    </div>
  {/if}

  {#if error}
    <div id={errorId} class="field-error" role="alert">
      {error}
    </div>
  {/if}
</div>

<style>
  .form-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .form-field.is-inline {
    align-self: flex-end;
  }

  .inline-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: 36px;
  }

  .inline-label {
    cursor: pointer;
    user-select: none;
    margin: 0;
  }

  .field-label-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, var(--text, #e6ebef));
  }

  .tooltip-trigger {
    background: transparent;
    border: none;
    padding: 0;
    cursor: pointer;
    color: var(--color-text-muted, var(--muted, #8995a1));
    display: inline-flex;
    align-items: center;
  }

  .tooltip-trigger:hover {
    color: var(--color-text, var(--text, #e6ebef));
  }

  .field-tooltip {
    font-size: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary, var(--panel-raised, #1d242c));
    border-radius: 4px;
    color: var(--color-text-muted, var(--muted, #8995a1));
    border: 1px solid var(--color-border, var(--line, #2d3741));
  }

  .field-error {
    font-size: 0.75rem;
    color: var(--color-error, var(--danger, #d97878));
    font-weight: 500;
  }
</style>
