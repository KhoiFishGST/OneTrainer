<script lang="ts">
  import Alert from '../ui/Alert.svelte';
  import Button from '../ui/Button.svelte';

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
  <div class="error-banner-owner">
    <Alert tone="error" class="error-banner">
      <div class="error-text">
        <strong>Error:</strong>
        <span>{message}</span>
      </div>
      <Button
        variant="danger"
        size="small"
        class="dismiss-btn"
        aria-label="Dismiss"
        onclick={handleDismiss}
      >
        Dismiss
      </Button>
    </Alert>
  </div>
{/if}

<style>
  .error-banner-owner {
    display: contents;
  }

  .error-banner-owner :global(.error-banner) {
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

  .error-banner-owner :global(.dismiss-btn) {
    min-height: 0;
    background: transparent;
    border: 1px solid var(--danger);
    color: var(--danger);
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .error-banner-owner :global(.dismiss-btn:hover) {
    background-color: var(--danger);
    color: #fff;
  }
</style>
