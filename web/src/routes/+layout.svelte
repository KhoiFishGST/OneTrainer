<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import LayoutContent from '$lib/components/LayoutContent.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import '../app.css';

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60,
        refetchOnWindowFocus: false,
      },
    },
  });

  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <LayoutContent>
    {@render children()}
  </LayoutContent>
  <Toaster />
</QueryClientProvider>
