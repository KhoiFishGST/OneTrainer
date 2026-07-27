<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { AlertTone } from './Alert.svelte';

  let {
    message,
    tone = 'info',
    duration = 4000,
    onDismiss,
    class: className = ''
  } = $props<{
    message: string;
    tone?: AlertTone;
    duration?: number;
    onDismiss: () => void;
    class?: string;
  }>();

  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  $effect(() => {
    message;
    tone;
    duration;
    onDismiss;
    clearTimer();
    if (message && duration > 0) {
      timer = setTimeout(() => {
        timer = null;
        onDismiss();
      }, duration);
    }
    return clearTimer;
  });

  onDestroy(clearTimer);
</script>

<div role="status" class={`toast toast--${tone} ${className}`}>{message}</div>

<style>
  :where(.toast) {
    padding: 0.75rem 1.25rem;
    border: 1px solid;
    border-radius: 8px;
    font-size: 0.9375rem;
    font-weight: 500;
  }
  :where(.toast--info) {
    background: rgba(59, 130, 246, 0.15);
    border-color: rgba(59, 130, 246, 0.3);
    color: #60a5fa;
  }
  :where(.toast--success) {
    background: rgba(16, 185, 129, 0.15);
    border-color: rgba(16, 185, 129, 0.3);
    color: #34d399;
  }
  :where(.toast--warning) {
    background: rgba(234, 179, 8, 0.12);
    border-color: rgba(234, 179, 8, 0.3);
    color: #fde047;
  }
  :where(.toast--error) {
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.3);
    color: #fca5a5;
  }
</style>
