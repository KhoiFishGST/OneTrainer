<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ConfigWorkspace } from '../config/workspace.svelte';
  import { setRouteContext } from '../config/context';
  import {
    createHealthQuery,
    createMetaQuery,
    createConfigQuery,
    createSchemaQuery,
    createUpdateConfigMutation,
  } from '../api/queries';

  let { children }: { children?: Snippet } = $props();

  const healthQuery = createHealthQuery();
  const metaQuery = createMetaQuery();
  const configQuery = createConfigQuery();
  const schemaQuery = createSchemaQuery();
  const updateConfigMutation = createUpdateConfigMutation();

  let workspace = $state<ConfigWorkspace | null>(null);
  let activeDirectoryPath = $state<string | null>(null);

  $effect(() => {
    if ($configQuery.data && $schemaQuery.data && !workspace) {
      workspace = new ConfigWorkspace(
        $configQuery.data,
        $schemaQuery.data,
        (req) => $updateConfigMutation.mutateAsync(req)
      );
    }
  });

  const schemaData = $derived($schemaQuery.data ?? {});

  setRouteContext({
    get workspace() {
      return workspace;
    },
    get schema() {
      return schemaData;
    },
    openDirectory: (currentPath: string) => {
      activeDirectoryPath = currentPath;
    },
  });

  const isApiError = $derived(
    $healthQuery.isError || $metaQuery.isError || $configQuery.isError || $schemaQuery.isError
  );
  const errorMessage = $derived(
    ($healthQuery.error as Error)?.message ||
      ($metaQuery.error as Error)?.message ||
      ($configQuery.error as Error)?.message ||
      ($schemaQuery.error as Error)?.message ||
      'API Connection Error'
  );
</script>

{#if isApiError}
  <div class="shell-error-banner" role="alert">
    <strong>Error:</strong>
    {errorMessage}
  </div>
{/if}

{#if children}
  {@render children()}
{/if}

<style>
  .shell-error-banner {
    background-color: var(--color-error-bg, #fef2f2);
    border-bottom: 1px solid var(--color-error-border, #fecaca);
    color: var(--color-error-text, #991b1b);
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
  }
</style>
