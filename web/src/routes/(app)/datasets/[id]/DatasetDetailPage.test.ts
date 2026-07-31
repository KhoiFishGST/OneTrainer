import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { readable } from 'svelte/store';
import DatasetDetailPage from './+page.svelte';
import * as queries from '$lib/api/queries';
import { uploadQueue } from '$lib/upload/upload-queue.svelte';


test('renders dataset detail header and upload button', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({
      data: {
        name: 'TestDataset',
        path: '/training_datasets/TestDataset',
        items: [
          {
            id: 'sample_01',
            media_name: 'sample_01.png',
            kind: 'image',
            caption_name: 'sample_01.txt',
            caption_content: 'a beautiful cat',
          },
        ],
      },
      isLoading: false,
    }) as any
  );

  render(DatasetDetailPage, { data: { id: 'TestDataset' } });
  expect(screen.getByText('Back to Datasets')).toBeInTheDocument();
  expect(screen.getByText('Add Files')).toBeInTheDocument();
  expect(await screen.findByText('TestDataset')).toBeInTheDocument();
  expect(await screen.findByText('sample_01')).toBeInTheDocument();

  const img = await screen.findByRole('img', { name: 'sample_01' });
  expect(img).toHaveAttribute(
    'src',
    '/api/datasets/image?dataset=TestDataset&filename=sample_01.png&thumb=true'
  );
});

test('file upload enqueues files and caption saves on blur event', async () => {
  const captionMutateAsync = vi.fn().mockResolvedValue({});

  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({
      data: {
        name: 'TestDataset',
        path: '/training_datasets/TestDataset',
        items: [
          {
            id: 'sample_01',
            media_name: 'sample_01.png',
            kind: 'image',
            caption_name: 'sample_01.txt',
            caption_content: 'a beautiful cat',
          },
        ],
      },
      isLoading: false,
    }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: captionMutateAsync, isPending: false }) as any
  );
  const enqueue = vi.spyOn(uploadQueue, 'enqueue');

  const { container } = render(DatasetDetailPage, { data: { id: 'TestDataset' } });

  // Verify caption save on blur
  const captionTextarea = await screen.findByDisplayValue('a beautiful cat');
  await fireEvent.input(captionTextarea, { target: { value: 'a fluffy cat' } });
  await fireEvent.blur(captionTextarea);

  expect(captionMutateAsync).toHaveBeenCalledWith({
    name: 'TestDataset',
    caption_name: 'sample_01.txt',
    content: 'a fluffy cat',
  });

  // Verify file enqueue
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  const file = new File(['dummy content'], 'test_image.png', { type: 'image/png' });
  await fireEvent.change(fileInput, { target: { files: [file] } });

  expect(enqueue).toHaveBeenCalledWith('TestDataset', expect.anything());
  
  enqueue.mockRestore();
});

test('dropping files renders a skeleton card and the summary bar', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds', path: '/ds', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  const enqueue = vi.spyOn(uploadQueue, 'enqueue');
  const { container } = render(DatasetDetailPage, { props: { data: { id: 'ds' } } });

  const region = container.querySelector('[aria-label="Dataset Detail"]')!;
  const file = new File([new Uint8Array(100)], 'a.png', { type: 'image/png' });
  await fireEvent.drop(region, { dataTransfer: { files: [file] } });

  expect(enqueue).toHaveBeenCalledWith('ds', expect.anything());

  enqueue.mockRestore();
  uploadQueue.clearFinished();
});

test('an uploading entry shows a progress card with a cancel control', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds2', path: '/ds2', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  vi.spyOn(uploadQueue, 'entriesFor').mockReturnValue([
    {
      id: 'upload-0',
      datasetName: 'ds2',
      filename: 'big.mp4',
      sent: 50,
      total: 200,
      status: 'uploading',
    },
  ]);

  render(DatasetDetailPage, { props: { data: { id: 'ds2' } } });

  expect(await screen.findByText('big.mp4')).toBeTruthy();
  expect(screen.getByLabelText('Upload progress for big.mp4').getAttribute('aria-valuenow')).toBe('25');
  expect(screen.getByRole('button', { name: /cancel upload/i })).toBeTruthy();

  vi.mocked(uploadQueue.entriesFor).mockRestore();
});

test('a failed entry offers retry and shows the server error', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds3', path: '/ds3', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  vi.spyOn(uploadQueue, 'entriesFor').mockReturnValue([
    {
      id: 'upload-1',
      datasetName: 'ds3',
      filename: 'evil.exe',
      sent: 0,
      total: 10,
      status: 'error',
      error: 'Unsupported file type: evil.exe',
    },
  ]);

  render(DatasetDetailPage, { props: { data: { id: 'ds3' } } });

  expect(await screen.findByText(/Unsupported file type/)).toBeTruthy();
  expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();

  vi.mocked(uploadQueue.entriesFor).mockRestore();
});

test('a canceled upload leaves no lingering card', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({ data: { name: 'ds4', path: '/ds4', items: [] }, isLoading: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: vi.fn() }) as any
  );

  vi.spyOn(uploadQueue, 'entriesFor').mockReturnValue([
    {
      id: 'upload-9',
      datasetName: 'ds4',
      filename: 'abandoned.mp4',
      sent: 12,
      total: 400,
      status: 'canceled',
    },
  ]);

  render(DatasetDetailPage, { props: { data: { id: 'ds4' } } });

  expect(screen.queryByText('abandoned.mp4')).toBeNull();
  expect(screen.queryByRole('progressbar')).toBeNull();

  vi.mocked(uploadQueue.entriesFor).mockRestore();
});
