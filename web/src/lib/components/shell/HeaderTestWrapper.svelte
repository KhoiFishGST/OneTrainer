<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import Header from './Header.svelte';

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  let props = $props();
</script>

<QueryClientProvider client={queryClient}>
  <Header {...props} />
</QueryClientProvider>
