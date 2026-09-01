import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readable } from 'svelte/store';
import DatasetPickerModal from './DatasetPickerModal.svelte';
import * as queries from '$lib/api/queries';

describe('DatasetPickerModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dataset cards loaded from API and selects on click', async () => {
    const mockDatasets = [
      {
        name: 'Dataset Alpha',
        path: '/training_datasets/Dataset Alpha',
        image_count: 10,
        caption_count: 10,
        thumbnail_url: '/api/datasets/image?dataset=Dataset%20Alpha&thumb=true',
      },
      {
        name: 'Dataset Beta',
        path: '/training_datasets/Dataset Beta',
        image_count: 5,
        caption_count: 5,
        thumbnail_url: '/api/datasets/image?dataset=Dataset%20Beta&thumb=true',
      },
    ];

    vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
      readable({
        data: { base_dir: '/training_datasets', datasets: mockDatasets },
        isLoading: false,
      }) as any
    );

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(DatasetPickerModal, {
      open: true,
      onSelect,
      onClose,
    });

    await waitFor(() => {
      expect(screen.getByText('Dataset Alpha')).toBeInTheDocument();
      expect(screen.getByText('Dataset Beta')).toBeInTheDocument();
    });

    const alphaCard = screen.getByText('Dataset Alpha').closest('button');
    expect(alphaCard).toBeInTheDocument();

    // Click card to select
    await fireEvent.click(alphaCard!);

    const confirmBtn = screen.getByRole('button', { name: 'Select Dataset' });
    await fireEvent.click(confirmBtn);
    expect(onSelect).toHaveBeenCalledWith('/training_datasets/Dataset Alpha');
  });

  it('confirms immediately on double click', async () => {
    const mockDatasets = [
      {
        name: 'Dataset Gamma',
        path: '/training_datasets/Dataset Gamma',
        image_count: 3,
        caption_count: 3,
        thumbnail_url: '/api/datasets/image?dataset=Dataset%20Gamma&thumb=true',
      },
    ];

    vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
      readable({
        data: { base_dir: '/training_datasets', datasets: mockDatasets },
        isLoading: false,
      }) as any
    );

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(DatasetPickerModal, {
      open: true,
      onSelect,
      onClose,
    });

    await waitFor(() => {
      expect(screen.getByText('Dataset Gamma')).toBeInTheDocument();
    });

    const gammaCard = screen.getByText('Dataset Gamma').closest('button');
    await fireEvent.dblClick(gammaCard!);

    expect(onSelect).toHaveBeenCalledWith('/training_datasets/Dataset Gamma');
  });

  it('triggers onClose when Cancel button is clicked', async () => {
    vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
      readable({
        data: { base_dir: '/training_datasets', datasets: [] },
        isLoading: false,
      }) as any
    );

    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(DatasetPickerModal, {
      open: true,
      onSelect,
      onClose,
    });

    await waitFor(() => {
      expect(screen.getByText('No datasets available')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByText('Cancel');
    await fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
