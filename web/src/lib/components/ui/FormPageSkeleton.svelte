<script lang="ts">
  import Skeleton from './Skeleton.svelte';

  let {
    rows = 3,
    rowHeight = '3rem',
    label = 'Loading configuration',
    padded = true,
    class: className = ''
  } = $props<{
    rows?: number;
    rowHeight?: string;
    label?: string;
    padded?: boolean;
    class?: string;
  }>();
</script>

<div
  class={`form-page-skeleton ${padded ? 'padded' : ''} ${className}`}
  role="status"
  aria-label={label}
>
  {#each Array(rows) as _, index (index)}
    <Skeleton height={rowHeight} />
  {/each}
</div>

<style>
  :where(.form-page-skeleton) {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  :where(.form-page-skeleton.padded) {
    padding: 1.5rem;
  }
</style>
