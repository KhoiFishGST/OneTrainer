<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import FormPageSkeleton from '$lib/components/loading/FormPageSkeleton.svelte';
  import * as Tabs from '$lib/components/ui/tabs';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'model') ?? {
      id: 'model',
      label: 'Model',
      groups: [],
    }
  );

  type ModelSubTab = 'model' | 'output' | 'quant' | 'text' | 'vae';

  const subnavTabs: Array<{ id: ModelSubTab; label: string }> = [
    { id: 'model', label: 'Model' },
    { id: 'output', label: 'Output' },
    { id: 'quant', label: 'Quant' },
    { id: 'text', label: 'Text' },
    { id: 'vae', label: 'VAE' },
  ];

  let activeSubTab = $state<ModelSubTab>('model');
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'Model'} class="model-header" />

    <!-- Connected Text-Only Model Sub-Nav Tabs -->
    <div class="model-tab-container">
      <Tabs.Root value={activeSubTab} onValueChange={(val) => { if (val) activeSubTab = val as ModelSubTab; }}>
        <Tabs.List variant="line">
          {#each subnavTabs as subtab (subtab.id)}
            <Tabs.Trigger value={subtab.id}>{subtab.label}</Tabs.Trigger>
          {/each}
        </Tabs.List>
      </Tabs.Root>

      <div class="tab-panel-body">
        <SchemaForm
          {tab}
          {activeSubTab}
          hideGroupTitle={true}
          values={ctx.workspace.draft}
          issues={ctx.workspace.errors}
          setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
          openDirectory={ctx.openDirectory}
        />
      </div>
    </div>
  </div>
{/if}

<style>
  .route-page {
    padding: 1.5rem;
  }

  .route-page :global(.model-header) {
    margin-bottom: 1rem;
  }

  .model-tab-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }
</style>
