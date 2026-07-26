import { render, screen } from '@testing-library/svelte';
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
