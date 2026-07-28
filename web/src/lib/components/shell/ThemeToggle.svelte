<script lang="ts">
  import { mode, setMode } from 'mode-watcher';
  import { Sun, Moon } from 'lucide-svelte';
  import Button from '../ui/Button.svelte';

  const currentMode = $derived(mode?.current ?? 'dark');
  const isDark = $derived(currentMode === 'dark');
  const ariaLabel = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

  function handleToggle() {
    if (isDark) {
      setMode('light');
    } else {
      setMode('dark');
    }
  }
</script>

<Button
  variant="ghost"
  size="icon"
  aria-label={ariaLabel}
  onclick={handleToggle}
  title={ariaLabel}
>
  {#if isDark}
    <Sun size={18} />
  {:else}
    <Moon size={18} />
  {/if}
</Button>
