import type {
  BacklogResponse,
  ConfigResponse,
  ConfigUpdateRequest,
  DirectoryListResponse,
  HealthResponse,
  MetaResponse,
  PresetLoadRequest,
  PresetsResponse,
  PresetSaveRequest,
  SchemaResponse,
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
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
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

    listDirectories: (path = '') => {
      const query = path ? `?path=${encodeURIComponent(path)}` : '';
      return request<DirectoryListResponse>(`${base}/api/fs/directories${query}`);
    },

    getBacklog: () => request<BacklogResponse>(`${base}/api/events/backlog`),
  };
}

export const api = createApi();
