export interface HealthResponse {
  status: string;
}

export interface ConfigResponse {
  config: Record<string, any>;
  revision: string;
}

export interface ConfigUpdateRequest {
  config: Record<string, any>;
  base_revision: string;
  overwrite?: boolean;
}

export interface SchemaResponse {
  [key: string]: any;
}

export interface MetaResponse {
  version: string;
  [key: string]: any;
}

export interface PresetsResponse {
  [key: string]: any;
}

export interface PresetLoadRequest {
  preset_id: string;
  base_revision: string;
  overwrite?: boolean;
}

export interface PresetSaveRequest {
  name: string;
}

export interface FileSystemEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes?: number;
  modified?: number;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size_bytes?: number;
  modified?: number;
}

export interface DirectoryListResponse {
  path: string;
  parent?: string | null;
  entries?: FileSystemEntry[];
  directories?: DirectoryEntry[];
  roots?: string[];
  truncated?: boolean;
}

export interface EventMessage {
  event: string;
  data: any;
  timestamp?: number;
}

export interface BacklogResponse {
  events?: EventMessage[];
  [key: string]: any;
}

export interface FieldError {
  path: string;
  message: string;
}

export interface Concept {
  name?: string;
  path?: string;
  instance_prompt?: string;
  class_prompt?: string;
  dataset_directory?: string;
  class_dataset_directory?: string;
  enabled?: boolean;
  repeats?: number;
  include_subdirectories?: boolean;
  loss_weight?: number;
  [key: string]: any;
}

export interface ConceptsResponse {
  concepts: Concept[];
}

