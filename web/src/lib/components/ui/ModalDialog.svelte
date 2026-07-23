<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { X } from 'lucide-svelte';

  let {
    open = $bindable(false),
    title = '',
    applyText = 'Apply',
    cancelText = 'Cancel',
    onClose,
    onApply,
    children,
  }: {
    open?: boolean;
    title?: string;
    applyText?: string;
    cancelText?: string;
    onClose?: () => void;
    onApply?: () => void;
    children?: Snippet;
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
    }
  }
</script>

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="presentation"
  >
    <div
      class="modal-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabindex="-1"
      onkeydown={handleKeyDown}
      bind:this={modalEl}
    >
      <div class="modal-header">
        <h3 id={titleId} class="modal-title">{title}</h3>
        <button
          type="button"
          class="close-btn"
          aria-label="Close"
          onclick={handleClose}
        >
          <X size={20} />
        </button>
      </div>

      <div class="modal-body">
        {#if children}
          {@render children()}
        {/if}
      </div>

      <div class="modal-footer">
        <button
          type="button"
          class="btn cancel-btn"
          onclick={handleClose}
        >
          {cancelText}
        </button>
        {#if onApply}
          <button
            type="button"
            class="btn apply-btn"
            onclick={handleApply}
          >
            {applyText}
          </button>
        {/if}
      </div>
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
  }

  .modal-dialog {
    background: var(--color-bg-card, #ffffff);
    color: var(--color-text, #111827);
    border-radius: 8px;
    width: 100%;
    max-width: 550px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--color-border, #e5e7eb);
    overflow: hidden;

    &:focus {
      outline: none;
    }
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--color-border, #e5e7eb);
  }

  .modal-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text-title, #111827);
  }

  .close-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--color-text-muted, #6b7280);
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
    color: var(--color-text, #111827);
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
    border-top: 1px solid var(--color-border, #e5e7eb);
    background: var(--color-bg-subtle, #f9fafb);
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .cancel-btn {
    background: transparent;
    border: 1px solid var(--color-border, #d1d5db);
    color: var(--color-text, #374151);
  }

  .cancel-btn:hover {
    background: var(--color-bg-hover, #f3f4f6);
  }

  .apply-btn {
    background: var(--color-primary, #2563eb);
    color: #ffffff;
    border: none;
  }

  .apply-btn:hover {
    background: var(--color-primary-hover, #1d4ed8);
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
