<script lang="ts">
  import { cn } from '$lib/utils';
  import { trainingStore } from '../../events/training-store';

  let { testId, class: className = '' } = $props<{
    testId: string;
    class?: string;
  }>();

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

<span
  data-testid={testId}
  class={cn('status-pill', statusClasses[trainingState] ?? statusClasses.IDLE, className)}
  title={$trainingStore.status?.error_message ?? ''}
>
  {trainingState}
</span>

<style>
  /*
    No `display` here. Svelte's scoped styles are unlayered and Tailwind's
    utilities live in @layer utilities, so a `display` declared here would beat
    the `hidden` / `md:inline-flex` utilities the callers rely on to place this
    pill on exactly one breakpoint.
  */
  .status-pill {
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    border-width: 1px;
    border-style: solid;
    white-space: nowrap;
  }
</style>
