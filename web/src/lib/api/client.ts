import type {
  AppearanceSettings,
  AppearanceUpdateRequest,
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
  GalleryRunModel,
  GalleryRunsResponse,
  SampleDefinition,
  SamplesResponse,
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

    saveConfigFile: async (name: string, overwrite = false) => {
      try {
        return await request<{ filename: string }>(`${base}/api/config/save_file`, {
          method: 'POST',
          body: JSON.stringify({ name, overwrite }),
        });
      } catch (err: any) {
        if (err?.status === 404) {
          return await request<{ filename: string }>(`${base}/api/config/save`, {
            method: 'POST',
            body: JSON.stringify({ name, overwrite }),
          });
        }
        throw err;
      }
    },

    loadConfigFile: (path: string, base_revision: string) =>
      request<ConfigResponse>(`${base}/api/config/load_file`, {
        method: 'POST',
        body: JSON.stringify({ path, base_revision }),
      }),

    loadGalleryRunConfig: (runKey: string, base_revision: string) =>
      request<ConfigResponse>(
        `${base}/api/gallery/runs/${encodeURIComponent(runKey)}/load`,
        {
          method: 'POST',
          body: JSON.stringify({ base_revision }),
        }
      ),

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

    getConceptStats: (path: string, advanced = false, includeSubdirectories = false) => {
      const q = new URLSearchParams({
        path,
        advanced: advanced ? 'true' : 'false',
        include_subdirectories: includeSubdirectories ? 'true' : 'false',
      }).toString();
      return request<Record<string, any>>(`${base}/api/concepts/stats?${q}`);
    },

    previewConceptAugmentation: (
      concept: Record<string, any>,
      imagePreviewFileIndex = 0,
      previewAugmentations = false
    ) =>
      request<{ image_data: string; filename: string; prompt: string }>(
        `${base}/api/concepts/preview-augmentation`,
        {
          method: 'POST',
          body: JSON.stringify({
            concept,
            image_preview_file_index: imagePreviewFileIndex,
            preview_augmentations: previewAugmentations,
          }),
        }
      ),

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

    requestSave: () =>
      request<{ status: string }>(`${base}/api/training/save`, {
        method: 'POST',
      }),

    getTrainingMetrics: () => request<TrainingMetric[]>(`${base}/api/training/metrics`),

    getTrainingSamples: () => request<TrainingSample[]>(`${base}/api/training/samples`),

    getGpuStats: () => request<GpuStat>(`${base}/api/training/gpu`),

    getDatasets: () => request<{ base_dir: string; datasets: any[] }>(`${base}/api/datasets`),

    setDatasetsBaseDir: (path: string) =>
      request<{ status: string; base_dir: string; resolved_base_dir: string }>(
        `${base}/api/datasets/base-dir`,
        {
          method: 'PUT',
          body: JSON.stringify({ path }),
        }
      ),

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

    uploadDatasetFile: (
      name: string,
      file: File,
      onProgress: (sent: number, total: number) => void
    ): UploadHandle =>
      xhrUpload(
        `${base}/api/datasets/${encodeURIComponent(name)}/upload`,
        file,
        onProgress
      ),

    updateCaption: (name: string, caption_name: string, content: string) =>
      request<{ status: string }>(`${base}/api/datasets/${encodeURIComponent(name)}/caption`, {
        method: 'PUT',
        body: JSON.stringify({ caption_name, content }),
      }),

    getGalleryRuns: () => request<GalleryRunsResponse>(`${base}/api/gallery/runs`),

    getGalleryRun: (runKey: string) =>
      request<GalleryRunModel>(`${base}/api/gallery/runs/${encodeURIComponent(runKey)}`),

    getGalleryRunMetrics: (runKey: string) =>
      request<{ metrics: TrainingMetric[] }>(
        `${base}/api/gallery/runs/${encodeURIComponent(runKey)}/metrics`
      ),

    getCurrentGallery: () => request<GalleryRunModel>(`${base}/api/gallery/current`),

    getSamples: (file?: string) => {
      const query = file ? `?file=${encodeURIComponent(file)}` : '';
      return request<SamplesResponse>(`${base}/api/samples${query}`);
    },

    updateSamples: (samples: SampleDefinition[], file?: string) => {
      const query = file ? `?file=${encodeURIComponent(file)}` : '';
      return request<SamplesResponse>(`${base}/api/samples${query}`, {
        method: 'PUT',
        body: JSON.stringify({ samples }),
      });
    },

    getSampleFiles: () => request<{ files: string[] }>(`${base}/api/samples/files`),

    createSampleFile: (name: string) =>
      request<{ filename: string }>(`${base}/api/samples/files`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    getAppearance: () => request<AppearanceSettings>(`${base}/api/appearance`),

    putAppearance: (data: AppearanceUpdateRequest) =>
      request<AppearanceSettings>(`${base}/api/appearance`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  };
}

export function galleryImageUrl(runKey: string, filename: string, base = ''): string {
  return `${base}/api/gallery/runs/${encodeURIComponent(runKey)}/images/${encodeURIComponent(filename)}`;
}

export const api = createApi();

export interface UploadHandle {
  promise: Promise<{ saved: string[] }>;
  abort: () => void;
}

/**
 * Upload one file to `url` with progress reporting.
 *
 * Uses XMLHttpRequest rather than fetch because fetch exposes no upload
 * progress in any shipping browser. Prefer `api.uploadDatasetFile`, which
 * applies the api base prefix.
 */
export function xhrUpload(
  url: string,
  file: File,
  onProgress: (sent: number, total: number) => void
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const formData = new FormData();
  formData.append('files', file);

  const promise = new Promise<{ saved: string[] }>((resolve, reject) => {
    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      let body: any;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = xhr.responseText;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body);
        return;
      }
      const detail = body?.detail !== undefined ? body.detail : body;
      reject(new ApiError(xhr.status, detail));
    };

    xhr.onerror = () => reject(new ApiError(0, 'Network error during upload'));

    xhr.onabort = () => {
      const err = new Error('Upload canceled');
      err.name = 'AbortError';
      reject(err);
    };

    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.send(formData);
  });

  return { promise, abort: () => xhr.abort() };
}

