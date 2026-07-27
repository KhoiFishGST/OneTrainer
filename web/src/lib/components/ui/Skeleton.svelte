<script lang="ts">
  let {
    height = '3rem',
    radius = '6px',
    class: className = ''
  } = $props<{
    height?: string;
    radius?: string;
    class?: string;
  }>();
</script>

<div
  class={`skeleton ${className}`}
  aria-hidden="true"
  style:height
  style:border-radius={radius}
></div>

<style>
  :where(.skeleton) {
    width: 100%;
    background: var(--color-skeleton, #e5e7eb);
    animation: skeleton-pulse 1.5s infinite ease-in-out;
  }
  @keyframes skeleton-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
