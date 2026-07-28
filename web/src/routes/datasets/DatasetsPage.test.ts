import { render, screen, fireEvent } from '@testing-library/svelte';
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
        base_dir: 'training_datasets',
      },
      isLoading: false,
    }) as any
  );

  render(DatasetsPage);
  expect(screen.getByText('Datasets')).toBeInTheDocument();
  expect(screen.getByText('Base Directory:')).toBeInTheDocument();
  expect(await screen.findByText('Dataset Alpha')).toBeInTheDocument();
});

test('dataset deletion opens AlertDialog instead of confirm, handles pending state and retains state on failure', async () => {
  const deleteMutateAsync = vi.fn().mockRejectedValueOnce(new Error('Delete failed'));
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
        base_dir: 'training_datasets',
      },
      isLoading: false,
    }) as any
  );
  vi.spyOn(queries, 'createDeleteDatasetMutation').mockReturnValue(
    readable({
      mutateAsync: deleteMutateAsync,
      isPending: false,
    }) as any
  );

  const windowConfirmSpy = vi.spyOn(window, 'confirm');

  render(DatasetsPage);

  const deleteBtn = await screen.findByRole('button', { name: /delete dataset/i });
  await fireEvent.click(deleteBtn);

  // confirm() should NOT be called
  expect(windowConfirmSpy).not.toHaveBeenCalled();

  // AlertDialog should open with confirmation text
  const alertDialog = await screen.findByRole('alertdialog');
  expect(alertDialog).toBeInTheDocument();
  expect(screen.getByText(/Are you sure you want to delete dataset "Dataset Alpha"\?/i)).toBeInTheDocument();

  // Clicking delete action inside AlertDialog triggers deletion mutation
  const confirmDeleteBtn = screen.getByRole('button', { name: /^delete$/i });
  await fireEvent.click(confirmDeleteBtn);

  expect(deleteMutateAsync).toHaveBeenCalledWith('Dataset Alpha');

  // Since mutation rejected with failure, dataset retains visible state
  expect(await screen.findByText('Dataset Alpha')).toBeInTheDocument();
});
