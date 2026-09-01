import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readable, writable } from 'svelte/store';
import ConceptsPage from './+page.svelte';
import * as queries from '$lib/api/queries';

vi.mock('$lib/api/queries', () => ({
  createConceptsQuery: vi.fn(),
  createUpdateConceptsMutation: vi.fn(),
  createDatasetsQuery: vi.fn().mockReturnValue(readable({ data: null, isLoading: false })),
}));

describe('Concepts page route component', () => {
  let conceptsStore: any;
  let mutateMock: any;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.restoreAllMocks();

    conceptsStore = writable({
      data: [
        { name: 'Concept 1', path: '/path/1', enabled: true, type: 'STANDARD' },
      ],
      isLoading: false,
      error: null,
    });
    mutateMock = vi.fn();

    vi.mocked(queries.createConceptsQuery).mockReturnValue(conceptsStore as any);
    vi.mocked(queries.createUpdateConceptsMutation).mockReturnValue(
      readable({
        mutate: mutateMock,
        mutateAsync: mutateMock,
        error: null,
      }) as any
    );
    vi.mocked(queries.createDatasetsQuery).mockReturnValue(
      readable({ data: null, isLoading: false }) as any
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading skeleton when conceptsQuery is loading', () => {
    conceptsStore.set({ data: null, isLoading: true, error: null });
    render(ConceptsPage);

    expect(screen.getByRole('status', { name: /loading concepts/i })).toBeInTheDocument();
  });

  it('renders error alert when conceptsQuery or mutation fails', () => {
    conceptsStore.set({ data: null, isLoading: false, error: new Error('Failed to load concepts') });
    render(ConceptsPage);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Failed to load concepts')).toBeInTheDocument();
  });

  it('debounces saving concepts by 1 second', async () => {
    render(ConceptsPage);

    await waitFor(() => {
      expect(screen.getByText('Concept 1')).toBeInTheDocument();
    });

    const cloneBtn = screen.getByTitle('Duplicate Concept');
    await fireEvent.click(cloneBtn);

    // Should not save immediately
    expect(mutateMock).not.toHaveBeenCalled();

    // Fast-forward 500ms - still not saved
    await act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).not.toHaveBeenCalled();

    // Fast-forward another 500ms - total 1000ms, should save
    await act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('retains concept detail modal open and displays error on save failure, closing on retry resolution', async () => {
    const mutateAsyncMock = vi.fn().mockRejectedValueOnce(new Error('Backend save error')).mockResolvedValueOnce({});
    vi.mocked(queries.createUpdateConceptsMutation).mockReturnValue(
      readable({
        mutateAsync: mutateAsyncMock,
        error: null,
      }) as any
    );

    render(ConceptsPage);

    await waitFor(() => {
      expect(screen.getByText('Concept 1')).toBeInTheDocument();
    });

    // Open detail modal for Concept 1
    const conceptCard = screen.getByText('Concept 1');
    await fireEvent.click(conceptCard);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Edit concept name input
    const nameInput = screen.getByLabelText(/^name/i);
    await fireEvent.input(nameInput, { target: { value: 'Edited Concept Name' } });

    // Click Save Concept Settings
    const saveBtn = screen.getByRole('button', { name: /Save Concept Settings|Save/i });
    await fireEvent.click(saveBtn);

    // Fast-forward 1000ms debounce
    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    // Dialog must remain open, edited value visible, error alert shown
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Edited Concept Name')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Backend save error');

    // Click Save again (retry)
    await fireEvent.click(saveBtn);

    await act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(2);
    });

    // After successful retry, dialog closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
