<script lang="ts">
  import { Save, FolderOpen, Box, Cpu, Star } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import OptionSheet from '../overlays/OptionSheet.svelte';
  import type { HeaderConfigApi } from './HeaderConfigControls.svelte';

  let { config, onLoadConfig, onSavePreset } = $props<{
    config: HeaderConfigApi;
    onLoadConfig: () => void;
    onSavePreset: () => void;
  }>();

  type SheetKind = 'model' | 'method' | 'preset' | null;

  let activeSheet = $state<SheetKind>(null);

  const sheet = $derived.by(() => {
    switch (activeSheet) {
      case 'model':
        return {
          title: 'Model Type',
          options: config.modelTypes,
          value: config.currentModelType,
          onSelect: config.onModelTypeChange,
        };
      case 'method':
        return {
          title: 'Training Method',
          options: config.trainingMethods,
          value: config.currentTrainingMethod,
          onSelect: config.onTrainingMethodChange,
        };
      case 'preset':
        return {
          title: 'Preset',
          options: config.presets,
          // A preset is applied, not held: nothing is "currently selected".
          value: '',
          onSelect: config.onSelectPreset,
        };
      default:
        return null;
    }
  });
</script>

<div class="flex items-center gap-0 md:hidden" data-testid="header-mobile-bar">
  <Button
    variant="ghost"
    size="icon"
    class="max-md:min-h-[44px] max-md:min-w-[44px]"
    aria-label="Model type"
    onclick={() => (activeSheet = 'model')}
  >
    <Box size={20} />
  </Button>

  <Button
    variant="ghost"
    size="icon"
    class="max-md:min-h-[44px] max-md:min-w-[44px]"
    aria-label="Training method"
    onclick={() => (activeSheet = 'method')}
  >
    <Cpu size={20} />
  </Button>

  <Button
    variant="ghost"
    size="icon"
    class="max-md:min-h-[44px] max-md:min-w-[44px]"
    aria-label="Preset"
    onclick={() => (activeSheet = 'preset')}
  >
    <Star size={20} />
  </Button>

  <Button
    variant="ghost"
    size="icon"
    class="max-md:min-h-[44px] max-md:min-w-[44px]"
    aria-label="Load"
    onclick={onLoadConfig}
  >
    <FolderOpen size={20} />
  </Button>

  <Button
    variant="ghost"
    size="icon"
    class="max-md:min-h-[44px] max-md:min-w-[44px]"
    aria-label="Save"
    onclick={onSavePreset}
  >
    <Save size={20} />
  </Button>
</div>

<OptionSheet
  open={activeSheet !== null}
  title={sheet?.title ?? ''}
  options={sheet?.options ?? []}
  value={sheet?.value ?? ''}
  onSelect={(val) => sheet?.onSelect(val)}
  onOpenChange={(open) => {
    if (!open) activeSheet = null;
  }}
/>
