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
  private activeSavePromise: Promise<ConfigResponse | void> | null = null;
  private mutationCount = 0;

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
    this.mutationCount++;
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

  private parse422Errors(detail: any): FieldError[] {
    if (Array.isArray(detail)) {
      return detail.map((e: any) => ({
        path: e.path ?? (Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : ''),
        message: e.message ?? e.msg ?? 'Validation error',
      }));
    }
    if (typeof detail === 'object' && detail !== null && detail.path) {
      return [detail as FieldError];
    }
    return [{ path: '', message: typeof detail === 'string' ? detail : 'Validation error' }];
  }

  flush(): Promise<ConfigResponse | void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    if (this.activeSavePromise !== null) {
      return this.activeSavePromise;
    }

    const valResult = validateConfig(this.draft, this.schema);
    if (!valResult.isValid) {
      this.errors = valResult.errors;
      this.state = 'unsaved';
      return Promise.resolve();
    }

    this.state = 'saving';
    const startMutation = this.mutationCount;

    const promise = (async (): Promise<ConfigResponse | void> => {
      try {
        const response = await this.putConfigFn({
          config: valResult.normalized,
          base_revision: this.baseline.revision,
          overwrite: false,
        });

        this.baseline = response;
        this.errors = [];
        this.conflictRevision = null;

        if (this.mutationCount === startMutation) {
          this.draft = cloneDocument(response.config || {});
          this.state = 'saved';
        } else {
          this.state = 'unsaved';
          if (this.autosaveTimer === null) {
            const nextVal = validateConfig(this.draft, this.schema);
            if (nextVal.isValid) {
              this.autosaveTimer = setTimeout(() => {
                this.autosaveTimer = null;
                this.flush();
              }, 500);
            }
          }
        }
        return response;
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode;
        const detail = err?.detail;

        if (status === 409) {
          this.conflictRevision = detail?.current_revision ?? (typeof detail === 'string' ? detail : null);
          this.state = 'conflict';
        } else if (status === 422) {
          this.errors = this.parse422Errors(detail);
          this.state = 'unsaved';
        } else {
          this.state = 'failed';
        }
      } finally {
        this.activeSavePromise = null;
      }
    })();

    this.activeSavePromise = promise;
    return promise;
  }

  async retry(): Promise<ConfigResponse | void> {
    if (this.state === 'failed' || this.state === 'unsaved') {
      const valResult = validateConfig(this.draft, this.schema);
      if (valResult.isValid) {
        return this.flush();
      }
    }
  }

  updateSchema(schema: ConfigSchema): void {
    this.schema = schema;
  }

  acceptRemote(envelope: ConfigResponse): void {
    if (envelope.revision === this.baseline.revision) {
      return;
    }

    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    if (this.activeSavePromise !== null || this.state === 'saving') {
      this.baseline = envelope;
      return;
    }

    if (!this.dirty) {
      this.mutationCount++;
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

    this.mutationCount++;
    this.draft = cloneDocument(this.baseline.config || {});
    this.errors = [];
    this.conflictRevision = null;
    this.state = 'saved';
  }

  overwriteServer(): Promise<ConfigResponse | void> {
    if (this.autosaveTimer !== null) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }

    if (this.activeSavePromise !== null) {
      return this.activeSavePromise;
    }

    const valResult = validateConfig(this.draft, this.schema);
    if (!valResult.isValid) {
      this.errors = valResult.errors;
      this.state = 'unsaved';
      return Promise.resolve();
    }

    this.state = 'saving';
    const startMutation = this.mutationCount;

    const baseRev = this.conflictRevision ?? this.baseline.revision;

    const promise = (async (): Promise<ConfigResponse | void> => {
      try {
        const response = await this.putConfigFn({
          config: valResult.normalized,
          base_revision: baseRev,
          overwrite: true,
        });

        this.baseline = response;
        this.errors = [];
        this.conflictRevision = null;

        if (this.mutationCount === startMutation) {
          this.draft = cloneDocument(response.config || {});
          this.state = 'saved';
        } else {
          this.state = 'unsaved';
          if (this.autosaveTimer === null) {
            const nextVal = validateConfig(this.draft, this.schema);
            if (nextVal.isValid) {
              this.autosaveTimer = setTimeout(() => {
                this.autosaveTimer = null;
                this.flush();
              }, 500);
            }
          }
        }
        return response;
      } catch (err: any) {
        const status = err?.status ?? err?.statusCode;
        const detail = err?.detail;

        if (status === 409) {
          this.conflictRevision = detail?.current_revision ?? null;
          this.state = 'conflict';
        } else if (status === 422) {
          this.errors = this.parse422Errors(detail);
          this.state = 'unsaved';
        } else {
          this.state = 'failed';
        }
      } finally {
        this.activeSavePromise = null;
      }
    })();

    this.activeSavePromise = promise;
    return promise;
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

    if (this.dirty || this.state === 'saving' || this.activeSavePromise !== null) {
      return this.flush();
    }
  }
}
