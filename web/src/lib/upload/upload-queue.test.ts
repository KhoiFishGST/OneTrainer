import { expect, test, vi } from 'vitest';
import { UploadQueue, type Uploader } from './upload-queue.svelte';

type Pending = {
  name: string;
  file: File;
  onProgress: (sent: number, total: number) => void;
  resolve: (v: any) => void;
  reject: (e: any) => void;
  aborted: boolean;
};

function fakeUploader() {
  const pending: Pending[] = [];
  const uploader: Uploader = (name, file, onProgress) => {
    let entry!: Pending;
    const promise = new Promise((resolve, reject) => {
      entry = { name, file, onProgress, resolve, reject, aborted: false };
    });
    pending.push(entry);
    return {
      promise: promise as Promise<{ saved: string[] }>,
      abort: () => {
        entry.aborted = true;
        const err = new Error('Upload canceled');
        err.name = 'AbortError';
        entry.reject(err);
      },
    };
  };
  return { uploader, pending };
}

function makeFiles(n: number, size = 100) {
  return Array.from(
    { length: n },
    (_, i) => new File([new Uint8Array(size)], `f${i}.png`, { type: 'image/png' })
  );
}

const flush = () => new Promise((r) => setTimeout(r, 0));

test('runs at most three uploads concurrently', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(5));
  await flush();

  expect(pending).toHaveLength(3);
  expect(queue.entries.filter((e) => e.status === 'uploading')).toHaveLength(3);
  expect(queue.entries.filter((e) => e.status === 'queued')).toHaveLength(2);

  pending[0].resolve({ saved: ['f0.png'] });
  await flush();

  expect(pending).toHaveLength(4);
});

test('a completed upload waits in processing until the event arrives', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1));
  await flush();
  pending[0].resolve({ saved: ['f0.png'] });
  await flush();

  expect(queue.entries[0].status).toBe('processing');

  queue.markProcessed('ds', 'f0.png');
  expect(queue.entries[0].status).toBe('done');
});

test('progress updates the entry byte count', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1, 400));
  await flush();
  pending[0].onProgress(160, 400);

  expect(queue.entries[0].sent).toBe(160);
  expect(queue.entries[0].total).toBe(400);
});

test('cancel aborts only its own entry and starts the next queued one', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(4));
  await flush();

  queue.cancel(queue.entries[0].id);
  await flush();

  expect(pending[0].aborted).toBe(true);
  expect(pending[1].aborted).toBe(false);
  expect(queue.entries[0].status).toBe('canceled');
  expect(pending).toHaveLength(4);
});

test('a failed upload records its error and can be retried', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1));
  await flush();
  pending[0].reject(new Error('Unsupported file type: f0.png'));
  await flush();

  expect(queue.entries[0].status).toBe('error');
  expect(queue.entries[0].error).toContain('Unsupported file type');

  queue.retry(queue.entries[0].id);
  await flush();

  expect(queue.entries[0].status).toBe('uploading');
  expect(queue.entries[0].sent).toBe(0);
  expect(pending).toHaveLength(2);
});

test('totals aggregate across mixed statuses', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(3, 100));
  await flush();

  pending[0].resolve({ saved: ['f0.png'] });
  await flush();
  queue.markProcessed('ds', 'f0.png');
  pending[1].onProgress(50, 100);
  pending[2].reject(new Error('boom'));
  await flush();

  expect(queue.totals).toMatchObject({
    files: 3,
    done: 1,
    failed: 1,
    sent: 150,
    total: 300,
  });
});

test('entriesFor filters by dataset', async () => {
  const { uploader } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('alpha', makeFiles(1));
  queue.enqueue('beta', makeFiles(2));
  await flush();

  expect(queue.entriesFor('alpha')).toHaveLength(1);
  expect(queue.entriesFor('beta')).toHaveLength(2);
});

test('a confirmation arriving before the HTTP response still completes the entry', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(1));
  await flush();

  // The server publishes dataset.file.added before returning the HTTP
  // response, so the WebSocket frame routinely wins the race on localhost.
  queue.markProcessed('ds', 'f0.png');
  pending[0].resolve({ saved: ['f0.png'] });
  await flush();

  expect(queue.entries[0].status).toBe('done');
});

test('a stale confirmation does not complete a later re-upload', async () => {
  const { uploader, pending } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.markProcessed('ds', 'f0.png');
  queue.enqueue('ds', makeFiles(1));
  await flush();

  expect(queue.entries[0].status).toBe('uploading');

  pending[0].resolve({ saved: ['f0.png'] });
  await flush();

  expect(queue.entries[0].status).toBe('processing');
});

test('canceled entries are excluded from the aggregate totals', async () => {
  const { uploader } = fakeUploader();
  const queue = new UploadQueue(uploader);

  queue.enqueue('ds', makeFiles(3, 100));
  await flush();

  queue.cancel(queue.entries[0].id);
  await flush();

  expect(queue.entries[0].status).toBe('canceled');
  expect(queue.totals).toMatchObject({ files: 2, total: 200 });
});
