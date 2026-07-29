<script lang="ts">
  import { Save, RotateCcw, RefreshCw, AlertTriangle } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils';
  import { trainingStore } from '../../events/training-store';
  import type { ConfigWorkspace } from '../../config/workspace.svelte';

  let { workspace = null } = $props<{ workspace?: ConfigWorkspace | null }>();

  const trainingState = $derived($trainingStore.status?.state ?? 'IDLE');

  const statusClasses: Record<string, string> = {
    IDLE: 'bg-muted text-muted-foreground border-border',
    STARTING: 'bg-info-surface text-info border-info/30 animate-pulse',
    TRAINING: 'bg-info-surface text-info border-info/30 animate-pulse',
    PAUSED: 'bg-warning-surface text-warning border-warning/30',
    STOPPING: 'bg-destructive-surface text-destructive border-destructive/40',
    FAILED: 'bg-destructive-surface text-destructive border-destructive/40',
    COMPLETED: 'bg-success-surface text-success border-success/30',
  };
</script>

{#if workspace}
  {#if workspace.state === 'saved'}
    <span
      class="saved-icon-badge text-success"
      title="All changes saved to training_presets/#.json"
      data-testid="saved-icon-badge"
    >
      <Save size={16} />
    </span>
  {:else if workspace.state === 'failed'}
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

<span
  data-testid="training-status-pill"
  class={cn('status-pill', statusClasses[trainingState] ?? statusClasses.IDLE)}
  title={$trainingStore.status?.error_message ?? ''}
>
  {trainingState}
</span>

<style>
  .state-badge {
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .saved-icon-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 4px;
    opacity: 0.9;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .saved-icon-badge:hover {
    opacity: 1;
    transform: scale(1.1);
  }

  .status-pill {
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    border-width: 1px;
    border-style: solid;
  }
</style>
