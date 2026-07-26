import { createQuery, createMutation, useQueryClient, QueryClient } from '@tanstack/svelte-query';
import { api } from './client';
import type { Concept, ConfigUpdateRequest, PresetLoadRequest, PresetSaveRequest } from './types';

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
  samples: () => ['samples'] as const,
  datasets: () => ['datasets'] as const,
  datasetFiles: (name: string) => ['datasets', name, 'files'] as const,
  trainingStatus: () => ['training', 'status'] as const,
  trainingMetrics: () => ['training', 'metrics'] as const,
  trainingSamples: () => ['training', 'samples'] as const,
  gpuStats: () => ['training', 'gpu'] as const,
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
  return createQuery({
    queryKey: queryKeys.schema(modelType, trainingMethod),
    queryFn: () =>
      api.getSchema(
        modelType && trainingMethod
          ? { model_type: modelType, training_method: trainingMethod }
          : undefined
      ),
    enabled: Boolean(modelType && trainingMethod),
  });
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

export function createUploadDatasetFilesMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: ({ name, formData }: { name: string; formData: FormData }) =>
        api.uploadDatasetFiles(name, formData),
      onSuccess: (_, variables) => {
        client.invalidateQueries({ queryKey: queryKeys.datasets() });
        client.invalidateQueries({ queryKey: queryKeys.datasetFiles(variables.name) });
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

export function createSamplesQuery() {
  const client = getSafeQueryClient();
  return createQuery(
    {
      queryKey: queryKeys.samples(),
      queryFn: async () => {
        const data = await api.getSamples();
        return data.samples;
      },
    },
    client
  );
}

export function createUpdateSamplesMutation() {
  const client = getSafeQueryClient();
  return createMutation(
    {
      mutationFn: async (samples: any[]) => {
        const data = await api.updateSamples(samples);
        return data.samples;
      },
      onSuccess: (samples) => {
        client.setQueryData(queryKeys.samples(), samples);
        client.invalidateQueries({ queryKey: queryKeys.samples() });
      },
    },
    client
  );
}


