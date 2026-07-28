<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import FormPanel from '$lib/components/form/FormPanel.svelte';
  import Field from '$lib/components/form/Field.svelte';
  import Select from '$lib/components/form/ValueSelect.svelte';
  import PageHeader from '$lib/components/ui/PageHeader.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import FormPageSkeleton from '$lib/components/ui/FormPageSkeleton.svelte';

  const ctx = getRouteContext();

  const tab = $derived(
    ctx.schema?.tabs?.find((t) => t.id === 'lora_embedding' || t.id === 'lora' || t.id === 'lora-embedding') ?? {
      id: 'lora_embedding',
      label: 'LoRA',
      groups: [],
    }
  );

  const peftTypeToGroup: Record<string, string> = {
    LORA: 'lora',
    LOHA: 'loha',
    OFT_2: 'oft',
    LOKR: 'lokr',
  };

  const peftType = $derived(ctx.workspace?.draft?.peft_type ?? 'LORA');
  const activeSubTab = $derived(peftTypeToGroup[peftType] ?? 'lora');

  const peftOptions = [
    { value: 'LORA', label: 'LoRA (Low-Rank Adaptation)' },
    { value: 'LOHA', label: 'LoHa (Low-Rank Hadamard Product)' },
    { value: 'OFT_2', label: 'OFT v2 (Orthogonal Fine-Tuning)' },
    { value: 'LOKR', label: 'LoKr (Low-Rank Kronecker Product)' },
  ];

  const filteredTab = $derived({
    ...tab,
    groups: (tab.groups || []).map((g: any) => ({
      ...g,
      fields: (g.fields || []).filter((f: any) => f.id !== 'peft-type' && f.keys?.[0] !== 'peft_type'),
    })),
  });

  const trainingMethod = $derived(ctx.workspace?.draft?.training_method ?? 'FINE_TUNE');
  const isLoraActive = $derived(trainingMethod === 'LORA');

  function handlePeftChange(val: string) {
    if (ctx.workspace && isLoraActive) {
      ctx.workspace.setRaw('peft_type', val);
    }
  }
</script>

{#if !ctx.workspace}
  <FormPageSkeleton />
{:else}
  <div class="route-page">
    <PageHeader title={tab.label || 'LoRA'} class="lora-header" />

    {#if !isLoraActive}
      <Alert tone="warning" class="lora-warning-alert">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-text">
          LoRA / PEFT options are disabled because the current training method is <strong>{trainingMethod}</strong>.
          Switch your Training Method to <strong>LORA</strong> in <em>Training &gt; Base</em> to enable editing these settings.
        </div>
      </Alert>
    {/if}

    <fieldset class="lora-fieldset" disabled={!isLoraActive}>
      <div class="lora-container">
        <FormPanel title="PEFT Options">
          <Field id="peft-type" label="PEFT Type" tooltip="Parameter-efficient fine-tuning type">
            {#snippet children({ id, ariaDescribedBy })}
              <Select
                {id}
                value={peftType}
                options={peftOptions}
                {ariaDescribedBy}
                onChange={handlePeftChange}
              />
            {/snippet}
          </Field>

          <SchemaForm
            tab={filteredTab}
            {activeSubTab}
            hideGroupTitle={true}
            values={ctx.workspace.draft}
            issues={ctx.workspace.errors}
            setRaw={(path: string, val: any) => ctx.workspace?.setRaw(path, val)}
            openDirectory={ctx.openDirectory}
          />
        </FormPanel>
      </div>
    </fieldset>
  </div>
{/if}

<style>
  .route-page {
    padding: 1.5rem;
  }

  .route-page :global(.lora-header) {
    margin-bottom: 1rem;
  }

  .route-page :global(.lora-warning-alert) {
    margin-bottom: 1.25rem;
    max-width: 740px;
  }

  .warning-icon {
    font-size: 1.125rem;
    line-height: 1;
    flex-shrink: 0;
  }

  .warning-text strong {
    color: var(--text-emphasis, #ffffff);
  }

  .lora-fieldset {
    border: none;
    padding: 0;
    margin: 0;
    min-width: 0;
    transition: opacity 0.2s ease, filter 0.2s ease;
  }

  .lora-fieldset:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    filter: grayscale(0.5);
  }

  .lora-fieldset:disabled :global(button),
  .lora-fieldset:disabled :global(input),
  .lora-fieldset:disabled :global(select) {
    pointer-events: none;
    cursor: not-allowed;
  }

  .lora-container {
    display: flex;
    flex-direction: column;
    width: 740px;
    max-width: 100%;
  }
</style>
