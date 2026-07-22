<script lang="ts">
  let {
    message = '',
    onDismiss,
  }: {
    message?: string;
    onDismiss?: () => void;
  } = $props();

  let dismissed = $state(false);

  $effect(() => {
    // Reset dismissal whenever error message changes
    if (message) {
      dismissed = false;
    }
  });

  function handleDismiss() {
    dismissed = true;
    if (onDismiss) {
      onDismiss();
    }
  }
</script>

{#if message && !dismissed}
  <div class="error-banner" role="alert">
    <div class="error-text">
      <strong>Error:</strong>
      <span>{message}</span>
    </div>
    <button
      type="button"
      class="dismiss-btn"
      aria-label="Dismiss"
      onclick={handleDismiss}
    >
      Dismiss
    </button>
  </div>
{/if}

<style>
  .error-banner {
    background-color: rgba(217, 120, 120, 0.2);
    border-bottom: 1px solid var(--danger);
    color: var(--danger);
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
    gap: 12px;
  }

  .error-text {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dismiss-btn {
    background: transparent;
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .dismiss-btn:hover {
    background-color: var(--danger);
    color: #fff;
  }
</style>
