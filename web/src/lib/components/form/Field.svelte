<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Info } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

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
      <div class="field-label-side">
        <label for={inputId} class="field-label">{label}</label>
        {#if tooltip}
          <Button
            type="button"
            variant="ghost"
            class="text-muted-foreground hover:text-foreground inline-flex items-center h-auto w-auto p-0 border-0 bg-transparent min-h-0 min-w-0"
            aria-label={`More information about ${label}`}
            aria-describedby={helpId}
            onmouseenter={handleMouseEnter}
            onmouseleave={handleMouseLeave}
            onmousemove={handleMouseMove}
            onclick={handleLabelClick}
            onkeydown={handleKeyDown}
          >
            <Info size={14} aria-hidden="true" />
          </Button>
          {#if showTooltip}
            <div class="field-tooltip" role="tooltip">{tooltip}</div>
          {/if}
        {/if}
      </div>
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
    grid-column: 1 / -1;
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

  .field-control-side {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 0 1 var(--width-field-control);
    width: var(--width-field-control);
    min-width: 0;
  }

  @media (max-width: 767px) {
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

  .field-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--foreground);
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
    background: var(--popover);
    color: var(--popover-foreground);
    border: 1px solid var(--border);
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
    border-color: var(--border) transparent transparent transparent;
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
    color: var(--destructive);
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
