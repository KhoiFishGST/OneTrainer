import type {
  BacklogResponse,
  Concept,
  ConceptsResponse,
  ConfigResponse,
  ConfigUpdateRequest,
  DirectoryListResponse,
  FileSystemEntry,
  HealthResponse,
  MetaResponse,
  PresetLoadRequest,
  PresetsResponse,
  PresetSaveRequest,
  SchemaResponse,
  TrainingStatus,
  TrainingMetric,
  TrainingSample,
  GpuStat,
} from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public detail: any
  ) {
    const msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
    super(`API Error ${status}: ${msg}`);
    this.name = 'ApiError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const { headers, ...restOptions } = options ?? {};
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    ...restOptions,
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    let detail: any;
    try {
      const data = await res.json();
      detail = data.detail !== undefined ? data.detail : data;
    } catch {
      detail = await res.text();
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export function createApi(base = '') {
  return {
    getHealth: () => request<HealthResponse>(`${base}/api/health`),

    getConfig: () => request<ConfigResponse>(`${base}/api/config`),

    putConfig: (data: ConfigUpdateRequest) =>
      request<ConfigResponse>(`${base}/api/config`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getSchema: (params?: { model_type?: string; training_method?: string }) => {
      const query = new URLSearchParams();
      if (params?.model_type) query.set('model_type', params.model_type);
      if (params?.training_method) query.set('training_method', params.training_method);
      const q = query.toString();
      const url = `${base}/api/config/schema${q ? `?${q}` : ''}`;
      return request<SchemaResponse>(url);
    },

    getMeta: () => request<MetaResponse>(`${base}/api/meta`),

    getPresets: () => request<PresetsResponse>(`${base}/api/presets`),

    loadPreset: (data: PresetLoadRequest) =>
      request<ConfigResponse>(`${base}/api/presets/load`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    savePreset: (data: PresetSaveRequest) =>
      request<{ filename: string }>(`${base}/api/presets/save`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    listDirectory: (
      path = '',
      mode: 'dir' | 'file' | 'both' = 'both',
      extensions?: string[]
    ) => {
      const query = new URLSearchParams();
      if (path) query.set('path', path);
      if (mode) query.set('mode', mode);
      if (extensions && extensions.length > 0) {
        extensions.forEach((ext) => query.append('extensions', ext));
      }
      const q = query.toString();
      return request<DirectoryListResponse>(`${base}/api/fs/list${q ? `?${q}` : ''}`);
    },

    listDirectories: (path = '') => {
      const query = path ? `?path=${encodeURIComponent(path)}` : '';
      return request<DirectoryListResponse>(`${base}/api/fs/directories${query}`);
    },

    getBacklog: () => request<BacklogResponse>(`${base}/api/events/backlog`),

    getConcepts: () => request<Concept[]>(`${base}/api/concepts`),

    putConcepts: (concepts: Concept[] | ConceptsResponse) =>
      request<ConceptsResponse>(`${base}/api/concepts`, {
        method: 'PUT',
        body: JSON.stringify(concepts),
      }),

    getTrainingStatus: () => request<TrainingStatus>(`${base}/api/training/status`),

    startTraining: (config?: Record<string, any>) =>
      request<TrainingStatus>(`${base}/api/training/start`, {
        method: 'POST',
        body: config ? JSON.stringify(config) : undefined,
      }),

    stopTraining: () =>
      request<TrainingStatus>(`${base}/api/training/stop`, {
        method: 'POST',
      }),

    pauseTraining: () =>
      request<TrainingStatus>(`${base}/api/training/pause`, {
        method: 'POST',
      }),

    resumeTraining: () =>
      request<TrainingStatus>(`${base}/api/training/resume`, {
        method: 'POST',
      }),

    requestSample: () =>
      request<{ status: string }>(`${base}/api/training/sample`, {
        method: 'POST',
      }),

    requestBackup: () =>
      request<{ status: string }>(`${base}/api/training/backup`, {
        method: 'POST',
      }),

    getTrainingMetrics: () => request<TrainingMetric[]>(`${base}/api/training/metrics`),

    getTrainingSamples: () => request<TrainingSample[]>(`${base}/api/training/samples`),

    getGpuStats: () => request<GpuStat>(`${base}/api/training/gpu`),

    getDatasets: () => request<{ base_dir: string; datasets: any[] }>(`${base}/api/datasets`),

    createDataset: (name: string) =>
      request<{ status: string; name: string; path: string }>(`${base}/api/datasets`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    deleteDataset: (name: string) =>
      request<{ status: string }>(`${base}/api/datasets/${encodeURIComponent(name)}`, {
        method: 'DELETE',
      }),

    getDatasetFiles: (name: string) =>
      request<{ name: string; path: string; items: any[] }>(
        `${base}/api/datasets/${encodeURIComponent(name)}/files`
      ),

    uploadDatasetFiles: (name: string, formData: FormData) =>
      fetch(`${base}/api/datasets/${encodeURIComponent(name)}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin',
      }).then((res) => {
        if (!res.ok) throw new ApiError(res.status, 'Upload failed');
        return res.json();
      }),

    updateCaption: (name: string, caption_name: string, content: string) =>
      request<{ status: string }>(`${base}/api/datasets/${encodeURIComponent(name)}/caption`, {
        method: 'PUT',
        body: JSON.stringify({ caption_name, content }),
      }),
  };
}

export const api = createApi();
