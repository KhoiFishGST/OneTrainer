<script lang="ts">
  import { Alert } from '$lib/components/ui/alert';
  import { Button } from '$lib/components/ui/button';

  let {
    message = '',
    onDismiss,
  }: {
    message?: string;
    onDismiss?: () => void;
  } = $props();

  let dismissed = $state(false);
  let previousMessage = $state('');

  $effect(() => {
    const current = message;
    if (current !== previousMessage) {
      if (current) {
        dismissed = false;
      }
      previousMessage = current;
    }
  });

  function handleDismiss() {
    dismissed = true;
    onDismiss?.();
  }
</script>

{#if message && !dismissed}
  <div class="error-banner">
    <Alert variant="destructive" class="bg-destructive-surface text-destructive border-b border-destructive flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
      <div class="flex items-center gap-2">
        <strong>Error:</strong>
        <span>{message}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        aria-label="Dismiss"
        onclick={handleDismiss}
      >
        Dismiss
      </Button>
    </Alert>
  </div>
{/if}

