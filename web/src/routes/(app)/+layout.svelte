<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import LayoutContent from '$lib/components/LayoutContent.svelte';
  import { createAppQueryClient } from '$lib/api/query-client';

  const queryClient = createAppQueryClient();

  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <LayoutContent>
    {@render children()}
  </LayoutContent>
</QueryClientProvider>
