<script lang="ts">
  import { QueryClientProvider } from '@tanstack/svelte-query';
  import LayoutContent from '$lib/components/LayoutContent.svelte';
  import { Toaster } from '$lib/components/ui/sonner';
  import { createAppQueryClient } from '$lib/api/query-client';
  import '../app.css';

  const queryClient = createAppQueryClient();

  let { children } = $props();
</script>

<QueryClientProvider client={queryClient}>
  <LayoutContent>
    {@render children()}
  </LayoutContent>
  <Toaster />
</QueryClientProvider>
