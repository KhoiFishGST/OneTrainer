import { render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import { readable } from 'svelte/store';
import DatasetsPage from './+page.svelte';
import * as queries from '$lib/api/queries';

test('renders Datasets title and add dataset card', async () => {
  vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
    readable({
      data: {
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
      },
      isLoading: false,
    }) as any
  );

  render(DatasetsPage);
  expect(screen.getByText('Datasets')).toBeInTheDocument();
  expect(screen.getByText('Add Dataset')).toBeInTheDocument();
  expect(await screen.findByText('Dataset 1')).toBeInTheDocument();
  expect(await screen.findByText('5 images')).toBeInTheDocument();
  expect(await screen.findByText('5 captions')).toBeInTheDocument();
});
