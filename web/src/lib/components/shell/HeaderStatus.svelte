<script lang="ts">
  import { RotateCcw, RefreshCw, AlertTriangle } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import type { ConfigWorkspace } from '../../config/workspace.svelte';

  let { workspace = null } = $props<{ workspace?: ConfigWorkspace | null }>();
</script>

{#if workspace}
  {#if workspace.state === 'failed'}
    <span class="state-badge bg-destructive-surface text-destructive">Save Failed</span>
    <Button variant="secondary" size="sm" onclick={() => workspace.retry()}>
      <RotateCcw size={14} />
      <span class="max-md:sr-only">Retry</span>
    </Button>
  {:else if workspace.state === 'conflict'}
    <span class="state-badge bg-destructive-surface text-destructive">Conflict</span>
    <Button variant="secondary" size="sm" onclick={() => workspace.reloadServer(true)}>
      <RefreshCw size={14} />
      <span class="max-md:sr-only">Reload</span>
    </Button>
    <Button variant="destructive" size="sm" onclick={() => workspace.overwriteServer()}>
      <AlertTriangle size={14} />
      <span class="max-md:sr-only">Overwrite</span>
    </Button>
  {/if}
{/if}

<style>
  .state-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }
</style>
