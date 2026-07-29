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
    wide = false,
    children,
  }: {
    id: string;
    label?: string;
    tooltip?: string;
    error?: string;
    inline?: boolean;
    fullWidth?: boolean;
    /**
     * The control benefits from room to read its value — a path, a filename,
     * free text. Such controls claim the full control-width token; everything
     * else lets the shared column shrink to fit its content.
     */
    wide?: boolean;
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

    <div class="field-control-side" class:is-wide={wide}>
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
  /* Narrow panels: label stacked above control, one field per row. */
  .form-field {
    display: grid;
    grid-template-columns: 1fr;
    grid-column: span 1;
    align-items: center;
    /* Set the two axes separately: the shorthand would also collapse the
       label-to-control gutter to the error-row spacing. */
    row-gap: 0.25rem;
    column-gap: 0.75rem;
    width: 100%;
  }

  /* Wide enough for label and control side by side. The field adopts the
     group's shared tracks (SchemaForm.svelte) instead of defining its own, so
     every control in the panel aligns to the panel's longest label. The
     matching breakpoint lives there — keep the two in step. */
  @container (min-width: 560px) {
    .form-field {
      grid-template-columns: subgrid;
      grid-column: span 2;
      width: auto;
    }
  }

  .form-field.is-full-width {
    grid-column: 1 / -1;
  }

  /* The row is only a grouping wrapper; its children are the real grid items. */
  .field-row {
    display: contents;
  }

  .field-label-side {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
    min-height: 36px;
  }

  /* The control column is content-sized (see SchemaForm), so a short select or
     a toggle leaves no dead space before the next pair. No floor here: the
     column should be free to shrink to a 32px switch. */
  .field-control-side {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    min-height: 36px;
  }

  /* Paths and free text read badly when cropped, so they claim the full
     control width and, being the widest item, size the shared column. Scoped
     to the paired layout: while stacked, the control is already full width and
     a 360px floor would overflow a phone. */
  @container (min-width: 560px) {
    .field-control-side.is-wide {
      min-width: var(--width-field-control);
    }
  }

  /* A full-width field has no second pair beside it, so let its control use
     the remaining tracks rather than stopping at the first control track. */
  @container (min-width: 560px) {
    .form-field.is-full-width .field-control-side {
      grid-column: 2 / -1;
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
    grid-column: 1 / -1;
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
