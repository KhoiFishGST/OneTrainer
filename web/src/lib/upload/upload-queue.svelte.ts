import { xhrUpload, type UploadHandle } from '$lib/api/client';

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'processing'
  | 'done'
  | 'error'
  | 'canceled';

export interface UploadEntry {
  id: string;
  datasetName: string;
  filename: string;
  sent: number;
  total: number;
  status: UploadStatus;
  error?: string;
}

export type Uploader = (
  name: string,
  file: File,
  onProgress: (sent: number, total: number) => void
) => UploadHandle;

const DEFAULT_CONCURRENCY = 3;

const TERMINAL: UploadStatus[] = ['done', 'error', 'canceled'];

export class UploadQueue {
  entries = $state<UploadEntry[]>([]);

  #uploader: Uploader;
  #concurrency: number;
  #files = new Map<string, File>();
  #handles = new Map<string, UploadHandle>();
  #nextId = 0;

  constructor(uploader: Uploader = xhrUpload, concurrency = DEFAULT_CONCURRENCY) {
    this.#uploader = uploader;
    this.#concurrency = concurrency;
  }

  get active(): boolean {
    return this.entries.some((e) => e.status === 'queued' || e.status === 'uploading');
  }

  get totals() {
    let done = 0;
    let failed = 0;
    let sent = 0;
    let total = 0;
    for (const e of this.entries) {
      total += e.total;
      if (e.status === 'done' || e.status === 'processing') {
        done += e.status === 'done' ? 1 : 0;
        sent += e.total;
      } else if (e.status === 'error') {
        failed += 1;
      } else {
        sent += e.sent;
      }
    }
    return { files: this.entries.length, done, failed, sent, total };
  }

  entriesFor(datasetName: string): UploadEntry[] {
    return this.entries.filter((e) => e.datasetName === datasetName);
  }

  enqueue(datasetName: string, files: File[] | FileList): void {
    for (const file of Array.from(files)) {
      const id = `upload-${this.#nextId++}`;
      this.#files.set(id, file);
      this.entries.push({
        id,
        datasetName,
        filename: file.name,
        sent: 0,
        total: file.size,
        status: 'queued',
      });
    }
    this.#pump();
  }

  cancel(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;

    if (entry.status === 'queued') {
      entry.status = 'canceled';
    } else if (entry.status === 'uploading') {
      this.#handles.get(id)?.abort();
    }
    this.#pump();
  }

  cancelAll(): void {
    for (const entry of [...this.entries]) {
      if (entry.status === 'queued' || entry.status === 'uploading') {
        this.cancel(entry.id);
      }
    }
  }

  retry(id: string): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry || entry.status !== 'error') return;
    entry.status = 'queued';
    entry.sent = 0;
    entry.error = undefined;
    this.#pump();
  }

  /** Called when a dataset.file.added event confirms server-side processing. */
  markProcessed(datasetName: string, filename: string): void {
    const entry = this.entries.find(
      (e) =>
        e.datasetName === datasetName &&
        e.filename === filename &&
        e.status === 'processing'
    );
    if (entry) entry.status = 'done';
  }

  clearFinished(): void {
    const removed = this.entries.filter((e) => TERMINAL.includes(e.status));
    for (const e of removed) {
      this.#files.delete(e.id);
      this.#handles.delete(e.id);
    }
    this.entries = this.entries.filter((e) => !TERMINAL.includes(e.status));
  }

  #pump(): void {
    let running = this.entries.filter((e) => e.status === 'uploading').length;
    for (const entry of this.entries) {
      if (running >= this.#concurrency) break;
      if (entry.status !== 'queued') continue;
      this.#start(entry);
      running += 1;
    }
  }

  #start(entry: UploadEntry): void {
    const file = this.#files.get(entry.id);
    if (!file) {
      entry.status = 'error';
      entry.error = 'File is no longer available';
      return;
    }

    entry.status = 'uploading';

    const handle = this.#uploader(entry.datasetName, file, (sent, total) => {
      entry.sent = sent;
      entry.total = total;
    });
    this.#handles.set(entry.id, handle);

    handle.promise
      .then(() => {
        entry.sent = entry.total;
        entry.status = 'processing';
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          entry.status = 'canceled';
        } else {
          entry.status = 'error';
          entry.error = err instanceof Error ? err.message : String(err);
        }
      })
      .finally(() => {
        this.#handles.delete(entry.id);
        this.#pump();
      });
  }
}

/** Module-level so uploads survive navigation away from the dataset page. */
export const uploadQueue = new UploadQueue();
