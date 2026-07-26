<script lang="ts">
  import { QueryClientProvider, type QueryClient } from '@tanstack/svelte-query';
  import LayoutContent from './LayoutContent.svelte';

  let { queryClient, children }: { queryClient: QueryClient; children?: any } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <LayoutContent>
    {#if children}
      {@render children()}
    {/if}
  </LayoutContent>
</QueryClientProvider>
