import { createQuery, createMutation, useQueryClient, QueryClient, type CreateQueryOptions, type CreateQueryResult } from '@tanstack/svelte-query';
import { api } from './client';
import type { AppearanceSettings, AppearanceUpdateRequest, Concept, ConfigUpdateRequest, PresetLoadRequest, PresetSaveRequest, SampleDefinition, SamplesResponse, GalleryRunModel } from './types';
import { appearance } from '$lib/stores/appearance.svelte';
import { toast } from 'svelte-sonner';

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

export function getSafeQueryClient(): QueryClient {
  try {
    return useQueryClient();
  } catch {
    return defaultQueryClient;
  }
}

export const queryKeys = {
  health: () => ['health'] as const,
  config: () => ['config'] as const,
  schema: (modelType?: string, trainingMethod?: string) =>
    ['schema', modelType ?? 'ALL', trainingMethod ?? 'ALL'] as const,
  meta: () => ['meta'] as const,
  presets: () => ['presets'] as const,
  directories: (path?: string) => ['directories', path ?? ''] as const,
  backlog: () => ['backlog'] as const,
  concepts: () => ['concepts'] as const,
  samples: (file?: string) => ['samples', file ?? 'default'] as const,
  sampleFiles: () => ['sampleFiles'] as const,
  datasets: () => ['datasets'] as const,
  datasetFiles: (name: string) => ['datasets', name, 'files'] as const,
  trainingStatus: () => ['training', 'status'] as const,
  trainingMetrics: () => ['training', 'metrics'] as const,
  trainingSamples: () => ['training', 'samples'] as const,
  gpuStats: () => ['training', 'gpu'] as const,
  gallery: () => ['gallery'] as const,
  galleryRuns: () => ['gallery', 'runs'] as const,
  galleryRun: (runKey: string) => ['gallery', 'runs', runKey] as const,
  galleryCurrent: () => ['gallery', 'current'] as const,
  appearance: () => ['appearance'] as const,
};

export function createHealthQuery() {
  return createQuery({
    queryKey: queryKeys.health(),
    queryFn: () => api.getHealth(),
  });
}

export function createConfigQuery() {
  return createQuery({
    queryKey: queryKeys.config(),
    queryFn: () => api.getConfig(),
  });
}

export function createSchemaQuery(modelType?: string, trainingMethod?: string) {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.schema(modelType, trainingMethod),
      queryFn: () =>
        api.getSchema(
          modelType && trainingMethod
            ? { model_type: modelType, training_method: trainingMethod }
            : undefined
        ),
      enabled: Boolean(modelType && trainingMethod),
    },
    client
  );
}

export function createMetaQuery() {
  return createQuery({
    queryKey: queryKeys.meta(),
    queryFn: () => api.getMeta(),
  });
}

export function createPresetsQuery() {
  return createQuery({
    queryKey: queryKeys.presets(),
    queryFn: () => api.getPresets(),
  });
}

export function createDirectoriesQuery(path?: string) {
  return createQuery({
    queryKey: queryKeys.directories(path),
    queryFn: () => api.listDirectories(path),
  });
}

export function createBacklogQuery() {
  return createQuery({
    queryKey: queryKeys.backlog(),
    queryFn: () => api.getBacklog(),
  });
}

export function createUpdateConfigMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: (data: ConfigUpdateRequest) => api.putConfig(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.config(), data);
    },
  });
}

export function createLoadPresetMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: (data: PresetLoadRequest) => api.loadPreset(data),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.config(), data);
    },
  });
}

export function createSavePresetMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: (data: PresetSaveRequest) => api.savePreset(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.presets() });
    },
  });
}

export function createConceptsQuery() {
  return createQuery({
    queryKey: queryKeys.concepts(),
    queryFn: () => api.getConcepts(),
  });
}

export function createUpdateConceptsMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: (concepts: Concept[]) => api.putConcepts(concepts),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.concepts(), data.concepts ?? data);
      queryClient.invalidateQueries({ queryKey: queryKeys.config() });
    },
  });
}

export function createTrainingStatusQuery() {
  return createQuery({
    queryKey: queryKeys.trainingStatus(),
    queryFn: () => api.getTrainingStatus(),
  });
}

export function createTrainingMetricsQuery() {
  return createQuery({
    queryKey: queryKeys.trainingMetrics(),
    queryFn: () => api.getTrainingMetrics(),
  });
}

export function createTrainingSamplesQuery() {
  return createQuery({
    queryKey: queryKeys.trainingSamples(),
    queryFn: () => api.getTrainingSamples(),
  });
}

export function createGpuStatsQuery() {
  return createQuery({
    queryKey: queryKeys.gpuStats(),
    queryFn: () => api.getGpuStats(),
  });
}

export function createStartTrainingMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: (config?: Record<string, any>) => api.startTraining(config),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.trainingStatus(), data);
    },
  });
}

export function createStopTrainingMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: () => api.stopTraining(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.trainingStatus(), data);
    },
  });
}

export function createPauseTrainingMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: () => api.pauseTraining(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.trainingStatus(), data);
    },
  });
}

export function createResumeTrainingMutation() {
  const queryClient = useQueryClient();
  return createMutation({
    mutationFn: () => api.resumeTraining(),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.trainingStatus(), data);
    },
  });
}

export function createRequestSampleMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: () => api.requestSample(),
    },
    client
  );
}

export function createRequestBackupMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: () => api.requestBackup(),
    },
    client
  );
}

export function createRequestSaveMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: () => api.requestSave(),
    },
    client
  );
}

export function createDatasetsQuery() {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.datasets(),
      queryFn: () => api.getDatasets(),
    },
    client
  );
}

export function createDatasetFilesQuery(name: string) {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.datasetFiles(name),
      queryFn: () => api.getDatasetFiles(name),
      enabled: Boolean(name),
    },
    client
  );
}

export function createCreateDatasetMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (name: string) => api.createDataset(name),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: queryKeys.datasets() });
      },
    },
    client
  );
}

export function createSetDatasetsBaseDirMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (path: string) => api.setDatasetsBaseDir(path),
      // Returned promise is awaited by TanStack Query before the per-call
      // onSuccess/onSettled run, so callers can rely on fresh data being in
      // the cache by then (no flicker back to the stale value).
      onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.datasets() }),
    },
    client
  );
}

export function createDeleteDatasetMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (name: string) => api.deleteDataset(name),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: queryKeys.datasets() });
      },
    },
    client
  );
}


export function createUpdateCaptionMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: ({
        name,
        caption_name,
        content,
      }: {
        name: string;
        caption_name: string;
        content: string;
      }) => api.updateCaption(name, caption_name, content),
      onSuccess: (_, variables) => {
        client.invalidateQueries({ queryKey: queryKeys.datasets() });
        client.invalidateQueries({ queryKey: queryKeys.datasetFiles(variables.name) });
      },
    },
    client
  );
}

export function createSamplesQuery(fileSupplier?: () => string | undefined): CreateQueryResult<SamplesResponse, Error> {
  const client = getSafeQueryClient();
  const file = fileSupplier?.();
  return createQuery(
    {
      queryKey: queryKeys.samples(file),
      queryFn: () => api.getSamples(fileSupplier?.()),
    },
    client
  );
}


export function createUpdateSamplesMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (payload: { samples: SampleDefinition[]; file?: string } | SampleDefinition[]) => {
        const samples = Array.isArray(payload) ? payload : payload.samples;
        const file = Array.isArray(payload) ? undefined : payload.file;
        return api.updateSamples(samples, file);
      },
      onSuccess: (data, variables) => {
        const file = Array.isArray(variables) ? undefined : variables.file;
        if (file) {
          client.setQueryData(queryKeys.samples(file), data);
        }
        client.setQueryData(['samples', 'samples.json'], data);
        client.setQueryData(['samples', undefined], data);
        client.invalidateQueries({ queryKey: ['samples'] });
      },


    },
    client
  );
}

export function createGalleryRunQuery(runKey?: string | null) {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.galleryRun(runKey ?? ''),
      queryFn: () => api.getGalleryRun(runKey as string),
      enabled: Boolean(runKey),
    },
    client
  );
}

export function createGalleryRunsQuery() {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.galleryRuns(),
      queryFn: () => api.getGalleryRuns(),
    },
    client
  );
}

export function createGalleryCurrentQuery() {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.galleryCurrent(),
      queryFn: () => api.getCurrentGallery(),
    },
    client
  );
}

export function createSampleFilesQuery() {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.sampleFiles(),
      queryFn: () => api.getSampleFiles(),
    },
    client
  );
}

export function createCreateSampleFileMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (name: string) => api.createSampleFile(name),
      onSuccess: () => {
        client.invalidateQueries({ queryKey: queryKeys.sampleFiles() });
      },
    },
    client
  );
}

export function createAppearanceQuery() {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.appearance(),
      queryFn: () => api.getAppearance(),
    },
    client
  );
}

export function createUpdateAppearanceMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: (data: AppearanceUpdateRequest) => api.putAppearance(data),
      // Optimistic write: the store already applied the change to the DOM and
      // localStorage before this mutation was even called, so this exists to
      // keep the query cache (and therefore anyone else reading it) in sync
      // with what the user is already seeing, and to give us a snapshot to
      // roll back to if the server rejects the write.
      onMutate: async (update) => {
        await client.cancelQueries({ queryKey: queryKeys.appearance() });
        const previous = client.getQueryData<AppearanceSettings>(queryKeys.appearance());
        if (previous) {
          client.setQueryData<AppearanceSettings>(queryKeys.appearance(), {
            ...previous,
            ...update,
          });
        }
        return { previous };
      },
      onError: (_err, _update, context) => {
        if (context?.previous) {
          client.setQueryData(queryKeys.appearance(), context.previous);
          // The cache alone isn't enough here: LayoutContent's reconcile
          // effect only reacts to a changed query result, and we want the
          // visible theme/animation state to snap back synchronously rather
          // than waiting on that to schedule.
          appearance.acceptRemote(context.previous);
        }
        toast.error("Couldn't save appearance settings");
      },
      onSuccess: (result) => {
        client.setQueryData(queryKeys.appearance(), result);
      },
      // Re-read the server regardless of outcome so any real divergence
      // (e.g. another browser tab's change) converges.
      onSettled: () => {
        client.invalidateQueries({ queryKey: queryKeys.appearance() });
      },
    },
    client
  );
}



