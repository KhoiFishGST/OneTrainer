import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { readable } from 'svelte/store';
import DatasetsPage from './+page.svelte';
import * as queries from '$lib/api/queries';

test('renders Data page title, base directory input, and dataset cards', async () => {
  vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
    readable({
      data: {
        datasets: [
          {
            name: 'Dataset Alpha',
            path: '/path/to/Dataset Alpha',
            image_count: 12,
            caption_count: 12,
            thumbnail_url: '/api/datasets/image?dataset=Dataset%20Alpha&thumb=true',
          },
        ],
        base_dir: 'workspace/datasets',
      },
      isLoading: false,
    }) as any
  );

  render(DatasetsPage);
  expect(screen.getByText('Datasets')).toBeInTheDocument();
  expect(screen.getByText('Base Directory:')).toBeInTheDocument();
  expect(await screen.findByText('Dataset Alpha')).toBeInTheDocument();
});
