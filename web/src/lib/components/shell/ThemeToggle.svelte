<script lang="ts">
  import { theme } from '$lib/stores/theme.svelte';
  import { Sun, Moon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  const isDark = $derived(theme.value === 'dark');
  const ariaLabel = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

  function handleToggle() {
    theme.toggle();
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
