import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
import { api } from './client';
import type { Concept, ConfigUpdateRequest, PresetLoadRequest, PresetSaveRequest } from './types';

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
  return createMutation({
    mutationFn: () => api.requestSample(),
  });
}

export function createRequestBackupMutation() {
  return createMutation({
    mutationFn: () => api.requestBackup(),
  });
}

