<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { X } from 'lucide-svelte';
  import Button from './Button.svelte';

  let {
    open = $bindable(false),
    title = '',
    applyText = 'Apply',
    cancelText = 'Cancel',
    align = 'center',
    width = 'default',
    showFooter = true,
    onClose,
    onApply,
    onKeyDown,
    children,
    'data-batch-id': dataBatchId,
    'data-prompt-id': dataPromptId,
    'data-variant': dataVariant,
  }: {
    open?: boolean;
    title?: string;
    applyText?: string;
    cancelText?: string;
    align?: 'top' | 'center';
    width?: 'default' | 'medium' | 'wide';
    showFooter?: boolean;
    onClose?: () => void;
    onApply?: () => void;
    onKeyDown?: (event: KeyboardEvent) => void;
    children?: Snippet;
    'data-batch-id'?: number | string;
    'data-prompt-id'?: string;
    'data-variant'?: string;
  } = $props();

  let modalEl = $state<HTMLDivElement | null>(null);
  let previousActiveElement = $state<HTMLElement | null>(null);

  const titleId = $derived(`modal-title-${Math.random().toString(36).substring(2, 9)}`);

  $effect(() => {
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement | null;
      tick().then(() => {
        modalEl?.focus();
      });
    } else {
      if (previousActiveElement) {
        previousActiveElement.focus();
        previousActiveElement = null;
      }
    }
  });

  function handleClose() {
    open = false;
    onClose?.();
  }

  function handleApply() {
    onApply?.();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleClose();
      return;
    }

    if (e.key === 'Tab' && modalEl) {
      const focusableSelector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusables = Array.from(
        modalEl.querySelectorAll<HTMLElement>(focusableSelector)
      );

      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl || !modalEl.contains(document.activeElement)) {
          lastEl.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastEl || !modalEl.contains(document.activeElement)) {
          firstEl.focus();
          e.preventDefault();
        }
      }
      return;
    }

    onKeyDown?.(e);
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    class:align-top={align === 'top'}
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="modal-dialog"
      class:modal-medium={width === 'medium'}
      class:modal-wide={width === 'wide'}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-batch-id={dataBatchId}
      data-prompt-id={dataPromptId}
      data-variant={dataVariant}
      tabindex="-1"
      onkeydown={handleKeyDown}
      bind:this={modalEl}
    >
      <div class="modal-header">
        <h3 id={titleId} class="modal-title">{title}</h3>
        <Button
          variant="ghost"
          size="icon"
          class="close-btn"
          aria-label="Close"
          onclick={handleClose}
        >
          <X size={20} />
        </Button>
      </div>

      <div class="modal-body">
        {#if children}
          {@render children()}
        {/if}
      </div>

      {#if showFooter}
        <div class="modal-footer">
          <Button
            variant="secondary"
            class="btn cancel-btn"
            onclick={handleClose}
          >
            {cancelText}
          </Button>
          {#if onApply}
            <Button
              variant="primary"
              class="btn apply-btn"
              onclick={handleApply}
            >
              {applyText}
            </Button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    overflow-y: auto;
  }

  .modal-backdrop.align-top {
    align-items: flex-start;
    padding: 3.5rem 1rem 1rem;
  }

  .modal-dialog {
    background: var(--panel-raised);
    color: var(--text);
    border-radius: 8px;
    width: 100%;
    max-width: 550px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--line);
    overflow: hidden;
  }

  .modal-dialog.modal-medium {
    max-width: 740px;
  }

  .modal-dialog.modal-wide {
    max-width: 1100px;
  }

  .modal-dialog:focus {
    outline: none;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--line);
  }

  .modal-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text);
  }

  :global(.close-btn) {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--muted);
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.close-btn:hover) {
    background: var(--control);
    color: var(--text);
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--line);
    background: var(--control);
  }

  :global(.btn) {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, opacity 0.15s ease;
  }

  :global(.cancel-btn) {
    background: transparent;
    border: 1px solid var(--line);
    color: var(--text);
  }

  :global(.cancel-btn:hover) {
    background: var(--control);
  }

  :global(.apply-btn) {
    background: var(--accent);
    color: #ffffff;
    border: none;
  }

  :global(.apply-btn:hover) {
    opacity: 0.9;
  }

  @media (max-width: 640px) {
    .modal-backdrop {
      padding: 0;
    }

    .modal-dialog {
      max-width: 100%;
      height: 100vh;
      max-height: 100vh;
      border-radius: 0;
    }
  }
</style>
