<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import StatusBar from './StatusBar.svelte';

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  let props = $props();
</script>

<QueryClientProvider client={queryClient}>
  <StatusBar {...props} />
</QueryClientProvider>
