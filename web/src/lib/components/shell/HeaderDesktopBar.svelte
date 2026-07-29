<script lang="ts">
  import { Save, FolderOpen } from '@lucide/svelte';
  import Select from '../form/ValueSelect.svelte';
  import { Button } from '$lib/components/ui/button';
  import type { HeaderConfigApi } from './HeaderConfigControls.svelte';

  let { config, onLoadConfig, onSavePreset } = $props<{
    config: HeaderConfigApi;
    onLoadConfig: () => void;
    onSavePreset: () => void;
  }>();
</script>

<div class="selectors hidden md:flex" data-testid="header-desktop-bar">
  <div class="selector-field">
    <span class="label-text">Model</span>
    <div class="header-select-wrapper">
      <Select
        ariaLabel="Model Type"
        value={config.currentModelType}
        options={config.modelTypes}
        onChange={config.onModelTypeChange}
      />
    </div>
  </div>

  <div class="selector-field">
    <span class="label-text">Method</span>
    <div class="header-select-wrapper">
      <Select
        ariaLabel="Training Method"
        value={config.currentTrainingMethod}
        options={config.trainingMethods}
        onChange={config.onTrainingMethodChange}
      />
    </div>
  </div>

  <div class="selector-field">
    <span class="label-text">Preset</span>
    <div class="header-select-wrapper">
      <Select
        ariaLabel="Presets"
        value=""
        placeholder="Select preset..."
        options={config.presets}
        onChange={config.onSelectPreset}
      />
    </div>
  </div>

  <Button variant="secondary" size="sm" class="self-end gap-1.5" onclick={onLoadConfig}>
    <FolderOpen size={15} />
    <span>Load</span>
  </Button>

  <Button variant="secondary" size="sm" class="self-end gap-1.5" onclick={onSavePreset}>
    <Save size={15} />
    <span>Save</span>
  </Button>
</div>

<style>
  .selectors {
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .selector-field {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .header-select-wrapper {
    min-width: 140px;
  }

  .label-text {
    font-size: 0.75rem;
    color: var(--muted-foreground);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
</style>
