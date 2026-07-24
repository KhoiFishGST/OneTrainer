import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import DatasetsPage from './+page.svelte';

test('renders Datasets title and add dataset card', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      datasets: [
        {
          name: 'Dataset 1',
          path: '/path/to/Dataset 1',
          image_count: 5,
          caption_count: 5,
          thumbnail_url: '/api/datasets/image?dataset=Dataset%201&thumb=true',
        },
      ],
      base_dir: 'workspace/datasets',
    }),
  }));

  render(DatasetsPage);
  expect(screen.getByText('Datasets')).toBeInTheDocument();
  expect(screen.getByText('Add Dataset')).toBeInTheDocument();
  expect(await screen.findByText('Dataset 1')).toBeInTheDocument();
  expect(await screen.findByText('5 images')).toBeInTheDocument();
});
