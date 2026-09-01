<script lang="ts">
  import { appearance } from '$lib/stores/appearance.svelte';
  import { Sun, Moon } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  const isDark = $derived(appearance.resolvedTheme === 'dark');
  const ariaLabel = $derived(isDark ? 'Switch to light theme' : 'Switch to dark theme');

  function handleToggle() {
    appearance.toggleTheme();
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
