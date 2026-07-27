<script lang="ts">
  import { getRouteContext } from '$lib/config/context';
  import SchemaForm from '$lib/components/form/SchemaForm.svelte';
  import FormPanel from '$lib/components/form/FormPanel.svelte';
  import Field from '$lib/components/form/Field.svelte';
  import Select from '$lib/components/form/Select.svelte';

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
  <div class="skeleton-container" aria-label="Loading configuration">
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
    <div class="skeleton-row"></div>
  </div>
{:else}
  <div class="route-page">
    <div class="page-header">
      <h1 class="page-title">{tab.label || 'LoRA'}</h1>
    </div>

    {#if !isLoraActive}
      <div class="disabled-warning-banner" role="alert">
        <span class="warning-icon" aria-hidden="true">⚠️</span>
        <div class="warning-text">
          LoRA / PEFT options are disabled because the current training method is <strong>{trainingMethod}</strong>.
          Switch your Training Method to <strong>LORA</strong> in <em>Training &gt; Base</em> to enable editing these settings.
        </div>
      </div>
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

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .page-title {
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0;
    color: var(--color-text-title, var(--accent, #3b82f6));
  }

  .disabled-warning-banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    background-color: var(--color-warning-bg, rgba(234, 179, 8, 0.12));
    border: 1px solid var(--color-warning-border, rgba(234, 179, 8, 0.3));
    color: var(--color-warning-text, #fde047);
    padding: 0.875rem 1rem;
    border-radius: 6px;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
    line-height: 1.4;
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

  .lora-fieldset:disabled button,
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

  .skeleton-container {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
  }

  .skeleton-row {
    height: 3rem;
    background: var(--color-skeleton, #e5e7eb);
    border-radius: 6px;
    animation: pulse 1.5s infinite ease-in-out;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
