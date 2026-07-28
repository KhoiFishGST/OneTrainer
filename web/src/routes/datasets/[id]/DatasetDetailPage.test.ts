import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { readable } from 'svelte/store';
import DatasetDetailPage from './+page.svelte';
import * as queries from '$lib/api/queries';

test('renders dataset detail header and upload button', async () => {
  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({
      data: {
        name: 'TestDataset',
        path: '/training_datasets/TestDataset',
        items: [
          {
            id: 'sample_01',
            image_name: 'sample_01.png',
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

test('file upload uses FormData payload and caption saves on blur event', async () => {
  const uploadMutateAsync = vi.fn().mockResolvedValue({});
  const captionMutateAsync = vi.fn().mockResolvedValue({});

  vi.spyOn(queries, 'createDatasetFilesQuery').mockReturnValue(
    readable({
      data: {
        name: 'TestDataset',
        path: '/training_datasets/TestDataset',
        items: [
          {
            id: 'sample_01',
            image_name: 'sample_01.png',
            caption_name: 'sample_01.txt',
            caption_content: 'a beautiful cat',
          },
        ],
      },
      isLoading: false,
    }) as any
  );
  vi.spyOn(queries, 'createUploadDatasetFilesMutation').mockReturnValue(
    readable({ mutateAsync: uploadMutateAsync, isPending: false }) as any
  );
  vi.spyOn(queries, 'createUpdateCaptionMutation').mockReturnValue(
    readable({ mutateAsync: captionMutateAsync, isPending: false }) as any
  );

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

  // Verify FormData upload payload
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  expect(fileInput).toBeInTheDocument();

  const file = new File(['dummy content'], 'test_image.png', { type: 'image/png' });
  await fireEvent.change(fileInput, { target: { files: [file] } });

  expect(uploadMutateAsync).toHaveBeenCalledOnce();
  const payload = uploadMutateAsync.mock.calls[0][0];
  expect(payload.name).toBe('TestDataset');
  expect(payload.formData).toBeInstanceOf(FormData);
  expect(payload.formData.get('files')).toBeInstanceOf(File);
});
