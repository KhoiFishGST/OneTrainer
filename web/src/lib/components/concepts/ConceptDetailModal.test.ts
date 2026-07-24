import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ConceptDetailModal from './ConceptDetailModal.svelte';

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

    expect(screen.getByLabelText(/dataset directory path/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select dataset/i })).toBeInTheDocument();
  });

  it('opens dataset picker modal when Select Dataset button is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        datasets: [
          {
            name: 'Dataset One',
            path: '/workspace/datasets/Dataset One',
            image_count: 8,
            caption_count: 8,
            thumbnail_url: '/api/datasets/image?dataset=Dataset%20One&thumb=true',
          },
        ],
      }),
    } as Response);

    render(ConceptDetailModal, {
      props: {
        concept: { name: 'Test Concept', path: '', enabled: true },
        isOpen: true,
        onSave: vi.fn(),
        onClose: vi.fn(),
      },
    });

    const selectDatasetBtn = screen.getByRole('button', { name: /select dataset/i });
    await fireEvent.click(selectDatasetBtn);

    await waitFor(() => {
      expect(screen.getByText('Dataset One')).toBeInTheDocument();
    });
  });
});
