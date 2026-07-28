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
  const helpId = $derived(tooltip ? `${inputId}-help` : undefined);
  const tooltipId = $derived(tooltip ? `${inputId}-tooltip` : undefined);

  const ariaDescribedBy = $derived(
    [errorId, helpId].filter(Boolean).join(' ') || undefined
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

  function handleKeyDown(e: KeyboardEvent) {
    if (!tooltip) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      showTooltip = !showTooltip;
    }
  }
</script>

<div class="form-field" class:is-inline={inline} class:is-full-width={fullWidth} class:has-error={!!error}>
  <div class="field-row">
    {#if label}
      {#if tooltip}
        <div
          role="button"
          tabindex="0"
          class="field-label-side has-tooltip text-left"
          onmouseenter={handleMouseEnter}
          onmouseleave={handleMouseLeave}
          onmousemove={handleMouseMove}
          onclick={handleLabelClick}
          onkeydown={handleKeyDown}
        >
          <label for={inputId} class="field-label cursor-help">{label}</label>

          {#if showTooltip}
            <div id={tooltipId} class="field-tooltip" role="tooltip">
              {tooltip}
            </div>
          {/if}
        </div>
      {:else}
        <div class="field-label-side">
          <label for={inputId} class="field-label">{label}</label>
        </div>
      {/if}
    {/if}

    <div class="field-control-side">
      {#if children}
        {@render children({ id: inputId, ariaDescribedBy })}
      {/if}
    </div>
  </div>

  {#if tooltip}
    <span id={helpId} class="sr-only">{tooltip}</span>
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
    text-decoration: underline dotted var(--border, #475569);
    text-underline-offset: 3px;
    transition: color 0.15s ease;
  }

  .field-label-side.has-tooltip:hover .field-label {
    color: var(--primary, #3b82f6);
  }

  .field-control-side {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 0 0 420px;
    width: 420px;
    min-width: 420px;
  }

  @media (max-width: 768px) {
    .field-row {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .field-control-side {
      flex: 1 1 100%;
      width: 100%;
      min-width: 0;
    }
  }

  /* Bits UI boundary: style child input components */
  .field-control-side :global(.text-input),
  .field-control-side :global(.number-input),
  .field-control-side :global(.directory-input-wrapper),
  .field-control-side :global(.time-input-group),
  .field-control-side :global(.control-with-action) {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 100% !important;
    box-sizing: border-box;
  }

  /* Bits UI boundary: style control action wrapper */
  .field-control-side :global(.control-with-action) {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  /* Bits UI boundary: style control target */
  .field-control-side :global(.control-with-action .control-target) {
    flex: 1 1 0%;
    min-width: 0;
    width: 100%;
  }

  /* Bits UI boundary: style action button component */
  .field-control-side :global(.control-with-action .action-btn) {
    flex: 0 0 auto;
    height: 38px;
    padding: 0 0.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border, #2d3741);
    border-radius: 6px;
    background: var(--muted, #14191f);
    color: var(--foreground, #e6ebef);
    cursor: pointer;
    box-sizing: border-box;
    transition: all 0.15s ease;
  }

  /* Bits UI boundary: style action button hover state */
  .field-control-side :global(.control-with-action .action-btn:hover:not(:disabled)) {
    background: var(--card, #1d242c);
    border-color: var(--primary, #3b82f6);
    color: var(--primary, #3b82f6);
  }

  /* Bits UI boundary: style action button disabled state */
  .field-control-side :global(.control-with-action .action-btn:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Bits UI boundary: style toggle input component */
  .field-control-side :global(.toggle-input) {
    margin-left: 0.25rem;
    margin-right: auto;
  }

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground, #e6ebef);
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
    background: var(--popover, #1a212a);
    color: var(--popover-foreground, #f1f5f9);
    border: 1px solid var(--border, #3b4754);
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
    border-color: var(--border, #3b4754) transparent transparent transparent;
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
    color: var(--destructive, #d97878);
    font-weight: 500;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
