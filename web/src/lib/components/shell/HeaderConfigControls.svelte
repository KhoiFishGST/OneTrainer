<script lang="ts" module>
  export type HeaderConfigApi = {
    modelTypes: Array<{ value: string; label: string }>;
    currentModelType: string;
    trainingMethods: Array<{ value: string; label: string }>;
    currentTrainingMethod: string;
    presets: Array<{ value: string; label: string }>;
    onModelTypeChange: (modelType: string) => void;
    onTrainingMethodChange: (method: string) => void;
    onSelectPreset: (presetId: string) => void;
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import {
    createMetaQuery,
    createPresetsQuery,
    createLoadPresetMutation,
  } from '../../api/queries';
  import type { ConfigWorkspace } from '../../config/workspace.svelte';

  let {
    workspace = null,
    metaData: metaDataProp = null,
    presetsData: presetsDataProp = null,
    children,
  } = $props<{
    workspace?: ConfigWorkspace | null;
    metaData?: any;
    presetsData?: any;
    children: Snippet<[HeaderConfigApi]>;
  }>();

  const metaQuery = createMetaQuery();
  const presetsQuery = createPresetsQuery();
  const loadPresetMutation = createLoadPresetMutation();

  const metaData = $derived(metaDataProp ?? $metaQuery.data);
  const presetsData = $derived(presetsDataProp ?? $presetsQuery.data);

  const modelTypes = $derived(
    metaData?.model_types?.map((mt: any) => ({ value: mt.value, label: mt.label })) ?? []
  );

  const currentModelType = $derived(workspace?.draft?.model_type ?? '');

  const currentModelTypeObj = $derived(
    metaData?.model_types?.find((mt: any) => mt.value === currentModelType)
  );

  const trainingMethods = $derived(
    currentModelTypeObj?.training_methods?.map((tm: any) => ({
      value: tm.value,
      label: tm.label,
    })) ?? []
  );

  const currentTrainingMethod = $derived(workspace?.draft?.training_method ?? '');

  const presetsTree = $derived(presetsData ?? []);

  const flattenedPresets = $derived.by(() => {
    const list: Array<{ value: string; label: string }> = [];

    function traverse(nodes: any[], prefix = '') {
      if (!Array.isArray(nodes)) return;
      for (const node of nodes) {
        if (!node) continue;
        if (node.children && Array.isArray(node.children)) {
          const nextPrefix = prefix ? `${prefix} / ${node.label}` : node.label;
          traverse(node.children, nextPrefix);
        } else if (node.id) {
          const label = prefix ? `${prefix} / ${node.label}` : node.label;
          list.push({ value: node.id, label });
        }
      }
    }

    traverse(presetsTree);
    return list;
  });

  function handleModelTypeChange(newModelType: string) {
    if (!workspace) return;

    const newModelTypeObj = metaData?.model_types?.find(
      (mt: any) => mt.value === newModelType
    );
    const supportedMethods =
      newModelTypeObj?.training_methods?.map((tm: any) => tm.value) ?? [];

    if (
      supportedMethods.length > 0 &&
      !supportedMethods.includes(currentTrainingMethod)
    ) {
      workspace.setRaw('training_method', supportedMethods[0]);
    }

    workspace.setRaw('model_type', newModelType);
  }

  function handleTrainingMethodChange(newMethod: string) {
    if (!workspace) return;
    workspace.setRaw('training_method', newMethod);
  }

  async function handleSelectPreset(presetId: string) {
    if (!presetId || !workspace) return;

    try {
      await $loadPresetMutation.mutateAsync({
        preset_id: presetId,
        base_revision: workspace.revision,
        overwrite: false,
      });
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if (status === 409) {
        workspace.conflictRevision = err?.detail?.current_revision ?? null;
        workspace.state = 'conflict';
      }
    }
  }

  const api = $derived<HeaderConfigApi>({
    modelTypes,
    currentModelType,
    trainingMethods,
    currentTrainingMethod,
    presets: flattenedPresets,
    onModelTypeChange: handleModelTypeChange,
    onTrainingMethodChange: handleTrainingMethodChange,
    onSelectPreset: handleSelectPreset,
  });
</script>

{@render children(api)}
