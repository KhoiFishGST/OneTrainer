import type { ConfigResponse, ConfigUpdateRequest, FieldError } from '../api/types';
import { cloneDocument, getPath, setPath } from './path';
import { validateConfig, type ConfigSchema } from './validation';

export type WorkspaceState = 'saved' | 'unsaved' | 'saving' | 'conflict' | 'failed';

export class ConfigWorkspace {
  state = $state<WorkspaceState>('saved');
  draft = $state<Record<string, any>>({});
  baseline = $state<ConfigResponse>({ config: {}, revision: '' });
  errors = $state<FieldError[]>([]);
  conflictRevision = $state<string | null>(null);

  private schema: ConfigSchema;
  private putConfigFn: (req: ConfigUpdateRequest) => Promise<ConfigResponse>;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    baselineEnvelope: ConfigResponse,
    schema: ConfigSchema,
    putConfigFn: (req: ConfigUpdateRequest) => Promise<ConfigResponse>
  ) {
    this.baseline = baselineEnvelope;
    this.draft = cloneDocument(baselineEnvelope?.config || {});
    this.schema = schema;
    this.putConfigFn = putConfigFn;
    this.state = 'saved';
  }

  get revision(): string {
    return this.baseline.revision;
  }

  get dirty(): boolean {
    return JSON.stringify(this.draft) !== JSON.stringify(this.baseline.config);
  }

  setRaw(path: string, rawValue: any): void {
    this.draft = setPath(this.draft, path, rawValue);
    const result = validateConfig(this.draft, this.schema);

    this.state = 'unsaved';

    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    if (!result.isValid) {
      this.errors = result.errors;
    } else {
      this.errors = [];
      this.autosaveTimer = setTimeout(() => {
        this.autosaveTimer = null;
        this.flush();
      }, 500);
    }
  }

  async flush(): Promise<ConfigResponse | void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    if (this.state === 'saving') {
      return;
    }

    const valResult = validateConfig(this.draft, this.schema);
    if (!valResult.isValid) {
      this.errors = valResult.errors;
      this.state = 'unsaved';
      return;
    }

    this.state = 'saving';

    try {
      const response = await this.putConfigFn({
        config: valResult.normalized,
        base_revision: this.baseline.revision,
        overwrite: false,
      });

      this.baseline = response;
      this.draft = cloneDocument(response.config || {});
      this.errors = [];
      this.conflictRevision = null;
      this.state = 'saved';
      return response;
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const detail = err?.detail;

      if (status === 409) {
        this.conflictRevision = detail?.current_revision ?? (typeof detail === 'string' ? detail : null);
        this.state = 'conflict';
      } else if (status === 422) {
        if (Array.isArray(detail)) {
          this.errors = detail.map((e: any) => ({
            path: e.path ?? (Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : ''),
            message: e.message ?? e.msg ?? 'Validation error',
          }));
        } else if (typeof detail === 'object' && detail !== null && detail.path) {
          this.errors = [detail];
        } else {
          this.errors = [{ path: '', message: typeof detail === 'string' ? detail : 'Validation error' }];
        }
        this.state = 'unsaved';
      } else {
        this.state = 'failed';
      }
    }
  }

  async retry(): Promise<ConfigResponse | void> {
    if (this.state === 'failed' || this.state === 'unsaved') {
      const valResult = validateConfig(this.draft, this.schema);
      if (valResult.isValid) {
        return this.flush();
      }
    }
  }

  acceptRemote(envelope: ConfigResponse): void {
    if (envelope.revision === this.baseline.revision) {
      return;
    }

    if (!this.dirty) {
      this.baseline = envelope;
      this.draft = cloneDocument(envelope.config || {});
      this.errors = [];
      this.conflictRevision = null;
      this.state = 'saved';
    } else {
      this.conflictRevision = envelope.revision;
      this.state = 'conflict';
    }
  }

  reloadServer(confirm: boolean): void {
    if (!confirm) return;

    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    this.draft = cloneDocument(this.baseline.config || {});
    this.errors = [];
    this.conflictRevision = null;
    this.state = 'saved';
  }

  async overwriteServer(): Promise<ConfigResponse | void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    const valResult = validateConfig(this.draft, this.schema);
    if (!valResult.isValid) {
      this.errors = valResult.errors;
      this.state = 'unsaved';
      return;
    }

    this.state = 'saving';

    const baseRev = this.conflictRevision ?? this.baseline.revision;

    try {
      const response = await this.putConfigFn({
        config: valResult.normalized,
        base_revision: baseRev,
        overwrite: true,
      });

      this.baseline = response;
      this.draft = cloneDocument(response.config || {});
      this.errors = [];
      this.conflictRevision = null;
      this.state = 'saved';
      return response;
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      const detail = err?.detail;

      if (status === 409) {
        this.conflictRevision = detail?.current_revision ?? null;
        this.state = 'conflict';
      } else if (status === 422) {
        if (Array.isArray(detail)) {
          this.errors = detail.map((e: any) => ({
            path: e.path ?? '',
            message: e.message ?? 'Validation error',
          }));
        } else {
          this.errors = [{ path: '', message: 'Validation error' }];
        }
        this.state = 'unsaved';
      } else {
        this.state = 'failed';
      }
    }
  }

  async beforePresetSave(): Promise<ConfigResponse | void> {
    if (this.state === 'conflict') {
      throw new Error('Cannot save preset during config conflict');
    }

    const valResult = validateConfig(this.draft, this.schema);
    if (!valResult.isValid) {
      this.errors = valResult.errors;
      this.state = 'unsaved';
      throw new Error('Cannot save preset with invalid config');
    }

    if (this.dirty) {
      return this.flush();
    }
  }
}
