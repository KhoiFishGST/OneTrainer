<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    id,
    label,
    tooltip,
    error,
    inline = false,
    fullWidth = false,
    children,
  }: {
    id: string;
    label?: string;
    tooltip?: string;
    error?: string;
    inline?: boolean;
    fullWidth?: boolean;
    children?: Snippet<[{ id: string; ariaDescribedBy?: string }]>;
  } = $props();

  let showTooltip = $state(false);
  let hoverTimer: ReturnType<typeof setTimeout> | null = null;
  let startX = 0;
  let startY = 0;

  const inputId = $derived(`field-${id}`);
  const errorId = $derived(error ? `${inputId}-error` : undefined);
  const tooltipId = $derived(tooltip ? `${inputId}-tooltip` : undefined);

  const ariaDescribedBy = $derived(
    [errorId, showTooltip ? tooltipId : undefined].filter(Boolean).join(' ') || undefined
  );

  function handleMouseEnter(e: MouseEvent) {
    if (!tooltip) return;
    startX = e.clientX;
    startY = e.clientY;
    if (hoverTimer) clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      showTooltip = true;
    }, 500);
  }

  function handleLabelClick(e: MouseEvent) {
    if (!tooltip) return;
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    startX = e.clientX;
    startY = e.clientY;
    showTooltip = true;
  }

  function handleMouseLeave() {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      hoverTimer = null;
    }
    showTooltip = false;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!showTooltip) return;
    const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
    if (distance > 20) {
      showTooltip = false;
    }
  }
</script>

<div class="form-field" class:is-inline={inline} class:is-full-width={fullWidth} class:has-error={!!error}>
  <div class="field-row">
    {#if label}
      <div
        class="field-label-side"
        class:has-tooltip={!!tooltip}
        onmouseenter={handleMouseEnter}
        onmouseleave={handleMouseLeave}
        onmousemove={handleMouseMove}
        onclick={handleLabelClick}
        role={tooltip ? 'button' : undefined}
        tabindex={tooltip ? 0 : undefined}
      >
        <label for={inputId} class="field-label">{label}</label>

        {#if tooltip && showTooltip}
          <div id={tooltipId} class="field-tooltip" role="tooltip">
            {tooltip}
          </div>
        {/if}
      </div>
    {/if}

    <div class="field-control-side">
      {#if children}
        {@render children({ id: inputId, ariaDescribedBy })}
      {/if}
    </div>
  </div>

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
    gap: 0.25rem;
    width: 100%;
  }

  .form-field.is-full-width {
    flex: 1 1 100%;
    width: 100%;
  }

  .field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 0.75rem;
    min-height: 36px;
  }

  .field-label-side {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex: 1 1 auto;
    min-width: 0;
  }

  .field-label-side.has-tooltip {
    cursor: help;
  }

  .field-label-side.has-tooltip .field-label {
    text-decoration: underline dotted var(--color-border, var(--line, #475569));
    text-underline-offset: 3px;
    transition: color 0.15s ease;
  }

  .field-label-side.has-tooltip:hover .field-label {
    color: var(--color-text-title, var(--accent, #dd773b));
  }

  .field-control-side {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex: 0 0 420px;
    width: 420px;
    min-width: 420px;
  }

  .field-control-side :global(.select-input),
  .field-control-side :global(.text-input),
  .field-control-side :global(.number-input),
  .field-control-side :global(.directory-input-wrapper),
  .field-control-side :global(.time-input-group) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box;
  }

  .field-control-side :global(.toggle-input) {
    margin-left: auto;
    margin-right: 8px;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text, var(--text, #e6ebef));
  }

  .field-tooltip {
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    z-index: 100;
    pointer-events: none;
    font-size: 0.75rem;
    line-height: 1.4;
    padding: 0.5rem 0.75rem;
    background: var(--panel-raised, #1a212a);
    color: var(--text, #f1f5f9);
    border: 1px solid var(--line, #3b4754);
    border-radius: 6px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    max-width: 320px;
    width: max-content;
    white-space: normal;
    animation: fadeIn 0.15s ease-out;
  }

  .field-tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 14px;
    border-width: 5px;
    border-style: solid;
    border-color: var(--line, #3b4754) transparent transparent transparent;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .field-error {
    font-size: 0.75rem;
    color: var(--color-error, var(--danger, #d97878));
    font-weight: 500;
  }
</style>
