<script module lang="ts">
  export type AlertTone = 'info' | 'success' | 'warning' | 'error';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    tone = 'info',
    children,
    class: className = ''
  } = $props<{
    tone?: AlertTone;
    children: Snippet;
    class?: string;
  }>();

  const role = $derived(tone === 'warning' || tone === 'error' ? 'alert' : 'status');
</script>

<div {role} class={`alert alert--${tone} ${className}`}>
  {@render children()}
</div>

<style>
  :where(.alert) {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 1rem;
    border: 1px solid;
    border-radius: 6px;
    font-size: 0.875rem;
  }
  :where(.alert--info) {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }
  :where(.alert--success) {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  :where(.alert--warning) {
    background: rgba(234, 179, 8, 0.12);
    border-color: rgba(234, 179, 8, 0.3);
    color: #fde047;
  }
  :where(.alert--error) {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #f87171;
  }
</style>
