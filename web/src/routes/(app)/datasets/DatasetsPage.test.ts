import { render, screen, fireEvent, waitFor, act } from '@testing-library/svelte';
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

test('dataset deletion opens AlertDialog, handles pending state, prevents duplicate calls, retains error on failure, and closes on resolution', async () => {
  let resolveDelete: (v?: any) => void = () => {};
  let rejectDelete: (e: any) => void = () => {};

  const deleteMutateAsync = vi.fn().mockImplementation(() => {
    return new Promise((res, rej) => {
      resolveDelete = res;
      rejectDelete = rej;
    });
  });

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

  expect(deleteMutateAsync).toHaveBeenCalledTimes(1);
  expect(deleteMutateAsync).toHaveBeenCalledWith('Dataset Alpha');

  // Confirmation remains open while pending and action button is disabled
  expect(alertDialog).toBeInTheDocument();
  expect(confirmDeleteBtn).toBeDisabled();

  // Second click while pending does not trigger additional call
  await fireEvent.click(confirmDeleteBtn);
  expect(deleteMutateAsync).toHaveBeenCalledTimes(1);

  // Rejection keeps dialog open with error message
  await act(async () => {
    rejectDelete(new Error('Delete dataset failed'));
  });

  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(await screen.findByText('Delete dataset failed')).toBeInTheDocument();
  expect(confirmDeleteBtn).not.toBeDisabled();

  // Click delete again to retry
  await fireEvent.click(confirmDeleteBtn);
  expect(deleteMutateAsync).toHaveBeenCalledTimes(2);

  // Resolving promise closes dialog
  await act(async () => {
    resolveDelete();
  });

  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});

test('failed base directory PUT keeps the typed value and surfaces an error', async () => {
  vi.useFakeTimers();
  try {
    vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
      readable({
        data: { datasets: [], base_dir: 'training_datasets' },
        isLoading: false,
      }) as any
    );

    // Stand-in for the real mutation: invokes the per-call onError, as
    // TanStack Query does when PUT /api/datasets/base-dir 500s.
    const mutate = vi.fn((_path: string, opts: any) => {
      opts?.onError?.(new Error('Settings file is not writable'));
    });
    vi.spyOn(queries, 'createSetDatasetsBaseDirMutation').mockReturnValue(
      readable({ mutate, isPending: false }) as any
    );

    render(DatasetsPage);

    const input = document.getElementById('base-datasets-dir') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'my_datasets' } });

    // Nothing is sent until the 600ms debounce elapses.
    expect(mutate).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toBe('my_datasets');

    // The draft survives the failure and the reason is visible.
    expect((document.getElementById('base-datasets-dir') as HTMLInputElement).value).toBe(
      'my_datasets'
    );
    expect(screen.getByText('Settings file is not writable')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});
