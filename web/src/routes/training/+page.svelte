<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import OptimizerParamsModal from '$lib/components/form/OptimizerParamsModal.svelte';
  import SchedulerParamsModal from '$lib/components/form/SchedulerParamsModal.svelte';
  import PageHeader from '$lib/components/layout/PageHeader.svelte';
  import FormPageSkeleton from '$lib/components/loading/FormPageSkeleton.svelte';
  import * as Tabs from '$lib/components/ui/tabs';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'training') ?? {
      id: 'training',
      label: 'Training',
      groups: [],
    }
  );

  type TrainingSubTab =
    | 'base'
    | 'execution'
    | 'text'
    | 'denoise'
    | 'layer'
    | 'noise'
    | 'masking'
    | 'loss';

  const subnavTabs: Array<{ id: TrainingSubTab; label: string }> = [
    { id: 'base', label: 'Base' },
    { id: 'execution', label: 'Execution' },
    { id: 'text', label: 'Text' },
    { id: 'denoise', label: 'Denoise' },
    { id: 'layer', label: 'Layer' },
    { id: 'noise', label: 'Noise' },
    { id: 'masking', label: 'Masking' },
    { id: 'loss', label: 'Loss' },
  ];

  let optimizerModalOpen = $state(false);
  let schedulerModalOpen = $state(false);
  let activeSubTab = $state<TrainingSubTab>('base');

  function handleSaveOptimizer(updatedValues: Record<string, any>) {
    if (ctx.workspace) {
      if (updatedValues.optimizer) {
        ctx.workspace.setRaw('optimizer.optimizer', updatedValues.optimizer);
      }
      if (updatedValues.optimizer_params) {
        for (const [key, val] of Object.entries(updatedValues.optimizer_params)) {
          ctx.workspace.setRaw(`optimizer.${key}`, val);
        }
      }
    }
  }

  function handleSaveScheduler(updatedValues: Record<string, any>) {
    if (ctx.workspace) {
      for (const [key, val] of Object.entries(updatedValues)) {
        ctx.workspace.setRaw(`optimizer.${key}`, val);
      }
    }
  }
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'Training'} class="training-header" />

    <!-- Connected Text-Only Training Sub-Nav Tabs -->
    <div class="training-tab-container">
      <Tabs.Root value={activeSubTab} onValueChange={(val) => { if (val) activeSubTab = val as TrainingSubTab; }}>
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
          onOpenOptimizerParams={() => (optimizerModalOpen = true)}
          onOpenSchedulerParams={() => (schedulerModalOpen = true)}
        />
      </div>
    </div>

    <OptimizerParamsModal
      bind:open={optimizerModalOpen}
      values={ctx.workspace.draft}
      onSave={handleSaveOptimizer}
    />

    <SchedulerParamsModal
      bind:open={schedulerModalOpen}
      values={ctx.workspace.draft}
      onSave={handleSaveScheduler}
    />
  </div>
{/if}

<style>
  .route-page {
    padding: 1.5rem;
  }

  .route-page :global(.training-header) {
    margin-bottom: 1rem;
  }

  .training-tab-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }
</style>
