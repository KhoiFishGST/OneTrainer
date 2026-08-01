<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import RoutePage from '$lib/components/layout/RoutePage.svelte';
  import FormPageSkeleton from '$lib/components/loading/FormPageSkeleton.svelte';
  import SubNav from '$lib/components/layout/SubNav.svelte';
  import WebUiSettingsPanel from '$lib/components/settings/WebUiSettingsPanel.svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'general') ?? {
      id: 'general',
      label: 'General',
      groups: [],
    }
  );

  type GeneralSubTab = 'workspace' | 'debug' | 'tensors' | 'hardware' | 'webui';

  const subnavTabs: Array<{ id: GeneralSubTab; label: string }> = [
    { id: 'workspace', label: 'Workspace' },
    { id: 'debug', label: 'Debug' },
    { id: 'tensors', label: 'Tensors' },
    { id: 'hardware', label: 'Hardware' },
    { id: 'webui', label: 'Web UI' },
  ];

  let activeSubTab = $state<GeneralSubTab>('workspace');
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <RoutePage>
    <PageHeader title={tab.label || 'General'} />

    <!-- Connected Text-Only General Sub-Nav Tabs -->
    <div class="general-tab-container">
      <SubNav
        items={subnavTabs}
        value={activeSubTab}
        onChange={(id) => (activeSubTab = id as GeneralSubTab)}
        label="General section"
      />

      <div class="tab-panel-body">
        {#if activeSubTab === 'webui'}
          <WebUiSettingsPanel />
        {:else}
          <SchemaForm
            {tab}
            {activeSubTab}
            hideGroupTitle={true}
            values={ctx.workspace.draft}
            issues={ctx.workspace.errors}
            setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
            openDirectory={ctx.openDirectory}
          />
        {/if}
      </div>
    </div>
  </RoutePage>
{/if}

<style>
  .general-tab-container {
    display: flex;
    flex-direction: column;
    width: 100%;
  }
</style>
