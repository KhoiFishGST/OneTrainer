import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatasetPickerModal from './DatasetPickerModal.svelte';

describe('DatasetPickerModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dataset cards loaded from API and selects on click', async () => {
    const mockDatasets = [
      {
        name: 'Dataset Alpha',
        path: '/workspace/datasets/Dataset Alpha',
        image_count: 10,
        caption_count: 10,
        thumbnail_url: '/api/datasets/image?dataset=Dataset%20Alpha&thumb=true',
      },
      {
        name: 'Dataset Beta',
        path: '/workspace/datasets/Dataset Beta',
        image_count: 5,
        caption_count: 5,
        thumbnail_url: '/api/datasets/image?dataset=Dataset%20Beta&thumb=true',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ datasets: mockDatasets }),
    } as Response);

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
    expect(onSelect).toHaveBeenCalledWith('/workspace/datasets/Dataset Alpha');
  });

  it('confirms immediately on double click', async () => {
    const mockDatasets = [
      {
        name: 'Dataset Gamma',
        path: '/workspace/datasets/Dataset Gamma',
        image_count: 3,
        caption_count: 3,
        thumbnail_url: '/api/datasets/image?dataset=Dataset%20Gamma&thumb=true',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ datasets: mockDatasets }),
    } as Response);

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

    expect(onSelect).toHaveBeenCalledWith('/workspace/datasets/Dataset Gamma');
  });

  it('triggers onClose when Cancel button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ datasets: [] }),
    } as Response);

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
