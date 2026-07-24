import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import DatasetDetailPage from './+page.svelte';

test('renders dataset detail header and upload button', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      name: 'TestDataset',
      path: '/workspace/datasets/TestDataset',
      items: [
        {
          id: 'sample_01',
          image_name: 'sample_01.png',
          caption_name: 'sample_01.txt',
          caption_content: 'a beautiful cat',
        },
      ],
    }),
  }));

  render(DatasetDetailPage, { data: { id: 'TestDataset' } });
  expect(screen.getByText('Back to Datasets')).toBeInTheDocument();
  expect(screen.getByText('Add Files')).toBeInTheDocument();
  expect(await screen.findByText('TestDataset')).toBeInTheDocument();
  expect(await screen.findByText('sample_01')).toBeInTheDocument();
});
