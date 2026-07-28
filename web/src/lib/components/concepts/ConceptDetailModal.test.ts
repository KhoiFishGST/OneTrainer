import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readable } from 'svelte/store';
import ConceptDetailModal from './ConceptDetailModal.svelte';
import * as queries from '$lib/api/queries';
import { api } from '$lib/api/client';

describe('ConceptDetailModal Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders dataset path input and Select Dataset button', () => {
    render(ConceptDetailModal, {
      props: {
        concept: { name: 'Test Concept', path: '/datasets/test', enabled: true },
        isOpen: true,
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    expect(screen.getByLabelText(/^path/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /datasets/i })).toBeInTheDocument();
  });

  it('opens dataset picker modal when Select Dataset button is clicked', async () => {
    vi.spyOn(queries, 'createDatasetsQuery').mockReturnValue(
      readable({
        data: {
          base_dir: '/training_datasets',
          datasets: [
            {
              name: 'Dataset One',
              path: '/training_datasets/Dataset One',
              image_count: 8,
              caption_count: 8,
              thumbnail_url: '/api/datasets/image?dataset=Dataset%20One&thumb=true',
            },
          ],
        },
        isLoading: false,
      }) as any
    );

    render(ConceptDetailModal, {
      props: {
        concept: { name: 'Test Concept', path: '', enabled: true },
        isOpen: true,
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    const selectDatasetBtn = screen.getByRole('button', { name: /datasets/i });
    await fireEvent.click(selectDatasetBtn);

    await waitFor(() => {
      expect(screen.getByText('Dataset One')).toBeInTheDocument();
    });
  });

  it('updates preview augmentation state before requesting the preview', async () => {
    const preview = vi.spyOn(api, 'previewConceptAugmentation').mockResolvedValue({ image_data: '', filename: 'x.png', prompt: 'x' });
    render(ConceptDetailModal, { props: { concept: { name: 'A', path: '/a', enabled: true }, isOpen: true, onSave: vi.fn(), onClose: vi.fn() } });
    await fireEvent.click(screen.getByRole('tab', { name: 'Image Augmentations' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    await fireEvent.click(await screen.findByLabelText('Preview Augmentations'));
    await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.any(Object), 0, true));
  });

  it('isolates deep draft from original concept object until saved', async () => {
    const originalConcept = { name: 'Original Name', path: '/orig', enabled: true };
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(ConceptDetailModal, {
      props: {
        concept: originalConcept,
        isOpen: true,
        onSave,
        onClose,
      },
    });

    const nameInput = screen.getByLabelText(/^name/i);
    await fireEvent.input(nameInput, { target: { value: 'Modified Draft Name' } });

    // Original concept prop should NOT be mutated
    expect(originalConcept.name).toBe('Original Name');

    // Save concept
    const saveBtn = screen.getByRole('button', { name: /Save Concept Settings|Save/i });
    await fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: 'Modified Draft Name' }));
  });

  it('retains draft and dialog open state when save fails', async () => {
    const originalConcept = { name: 'Concept A', path: '/path/a', enabled: true };
    const onSave = vi.fn().mockImplementation(() => {
      throw new Error('Save error');
    });

    render(ConceptDetailModal, {
      props: {
        concept: originalConcept,
        isOpen: true,
        onSave,
        onClose: vi.fn(),
      },
    });

    const nameInput = screen.getByLabelText(/^name/i);
    await fireEvent.input(nameInput, { target: { value: 'Failed Save Name' } });

    const saveBtn = screen.getByRole('button', { name: /Save Concept Settings|Save/i });
    await fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalled();
    // Modal dialog should still be visible and draft retained
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Failed Save Name')).toBeInTheDocument();
  });

  it('handles failed preview and stats requests gracefully', async () => {
    vi.spyOn(api, 'getConceptStats').mockRejectedValue(new Error('Stats network failure'));
    vi.spyOn(api, 'previewConceptAugmentation').mockRejectedValue(new Error('Preview failure'));

    render(ConceptDetailModal, {
      props: {
        concept: { name: 'Concept B', path: '/path/b', enabled: true },
        isOpen: true,
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    // Switch to Stats tab - should not throw unhandled exception
    await fireEvent.click(screen.getByRole('tab', { name: 'Statistics' }));
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Statistics' })).toBeInTheDocument();
    });

    // Switch to Image tab and click preview
    await fireEvent.click(screen.getByRole('tab', { name: 'Image Augmentations' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    // Should gracefully remain in preview modal
    await waitFor(() => {
      expect(screen.getByText('Sample #1')).toBeInTheDocument();
    });
  });
});
