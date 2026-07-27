<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import TabBar from '$lib/components/ui/TabBar.svelte';
  import FormPageSkeleton from '$lib/components/ui/FormPageSkeleton.svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'general') ?? {
      id: 'general',
      label: 'General',
      groups: [],
    }
  );

  type GeneralSubTab = 'workspace' | 'debug' | 'tensors' | 'hardware';

  const subnavTabs: Array<{ id: GeneralSubTab; label: string }> = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'debug', label: 'Debug' },
    { id: 'tensors', label: 'Tensors' },
    { id: 'hardware', label: 'Hardware' },
  ];

  let activeSubTab = $state<GeneralSubTab>('workspace');
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'General'} class="general-header" />

    <!-- Connected Text-Only General Sub-Nav Tabs -->
    <div class="general-tab-container">
      <TabBar
        tabs={subnavTabs}
        active={activeSubTab}
        onSelect={(id) => (activeSubTab = id)}
      />

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

  .route-page :global(.general-header) {
    margin-bottom: 1rem;
  }

  .general-tab-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }
</style>
