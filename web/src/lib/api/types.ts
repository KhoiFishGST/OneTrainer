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

export type TrainingState =
  | 'IDLE'
  | 'STARTING'
  | 'TRAINING'
  | 'PAUSED'
  | 'STOPPING'
  | 'COMPLETED'
  | 'FAILED';

export interface TrainingStatus {
  state: TrainingState | string;
  step: number;
  max_steps: number;
  epoch: number;
  max_epochs: number;
  speed_its: number;
  elapsed_seconds: number;
  eta_seconds: number;
  error_message?: string | null;
  has_snapshot: boolean;
}

export interface TrainingMetric {
  step?: number;
  epoch?: number;
  loss?: number;
  lr?: number;
  timestamp?: number;
  [key: string]: any;
}

export interface TrainingSample {
  id?: string;
  sample_id?: string;
  step?: number;
  epoch?: number;
  prompt?: string;
  seed?: number;
  url?: string;
  [key: string]: any;
}

export interface GpuStat {
  vram_used?: number;
  vram_total?: number;
  vram_used_mb?: number;
  vram_total_mb?: number;
  utilization?: number;
  temperature?: number;
  [key: string]: any;
}

export type GalleryVariant = 'base' | 'ema' | 'non_ema';
export type GallerySampleStatus = 'pending' | 'ready' | 'unavailable' | 'error';

export interface GalleryRunInfo {
  key: string;
  config_filename: string;
  started_at: string;
}

export interface GalleryRunSummary extends GalleryRunInfo {
  batch_count: number;
  latest_sampled_at?: string | null;
  active?: boolean;
}

export interface GalleryRunsResponse {
  runs: GalleryRunSummary[];
}

export interface GalleryPrompt extends Record<string, unknown> {
  webui_id: string;
  source_index: number;
  enabled: boolean;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  diffusion_steps: number;
  cfg_scale: number;
  seed?: number;
  random_seed?: boolean;
  noise_scheduler?: string;
}

export interface GalleryPromptRevision {
  captured_at: string;
  prompts: GalleryPrompt[];
}

export interface GallerySample {
  webui_prompt_id: string;
  source_index: number;
  variant: GalleryVariant;
  status: GallerySampleStatus;
  filename?: string | null;
  thumbnail_filename?: string | null;
  width?: number | null;
  height?: number | null;
  error?: string | null;
  thumbnail_error?: string | null;
}

export interface GalleryBatch {
  id: number;
  sampled_at: string;
  epoch: number;
  epoch_step: number;
  global_step: number;
  prompt_revision_id: string;
  expected_prompt_ids: string[];
  expected_variants: GalleryVariant[];
  samples: GallerySample[];
  unassigned_errors: Array<{ source_filename: string; message: string }>;
}

export interface GalleryRunModel {
  active: boolean;
  run: GalleryRunInfo | null;
  batches: GalleryBatch[];
  revisions: Record<string, GalleryPromptRevision>;
  warning?: string | null;
}

export interface SampleDefinition extends Record<string, unknown> {
  webui_id?: string;
  enabled?: boolean;
  prompt?: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  diffusion_steps?: number;
  cfg_scale?: number;
  seed?: number;
  random_seed?: boolean;
  noise_scheduler?: string;
}

export interface SamplesResponse {
  samples: SampleDefinition[];
  queued: boolean;
}



