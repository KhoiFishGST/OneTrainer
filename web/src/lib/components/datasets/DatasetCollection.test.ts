import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockIsMobile } from '$lib/hooks/mock-is-mobile.svelte';
import DatasetCollection from './DatasetCollection.svelte';

vi.mock('$lib/hooks/is-mobile.svelte', () => ({
  get isMobile() {
    return mockIsMobile;
  },
}));

const mediaListeners = new Set<(e: MediaQueryListEvent) => void>();

function mockMatchMedia(matches: boolean) {
  mockIsMobile.current = !matches;
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: matches ? 1024 : 500 });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn((cb) => mediaListeners.add(cb)),
      removeListener: vi.fn((cb) => mediaListeners.delete(cb)),
      addEventListener: vi.fn((type, cb) => {
        if (type === 'change' || !type) mediaListeners.add(cb);
      }),
      removeEventListener: vi.fn((type, cb) => {
        if (type === 'change' || !type) mediaListeners.delete(cb);
      }),
      dispatchEvent: vi.fn(),
    })),
  });
  mediaListeners.forEach((cb) => cb({ matches } as MediaQueryListEvent));
}

const mockDatasets = [
  {
    name: 'Dataset Alpha',
    path: '/path/to/Dataset Alpha',
    image_count: 12,
    caption_count: 12,
    thumbnail_url: '/api/datasets/image?dataset=Dataset%20Alpha&thumb=true',
  },
  {
    name: 'Dataset Beta',
    path: '/path/to/Dataset Beta',
    image_count: 5,
    caption_count: 5,
    thumbnail_url: '/api/datasets/image?dataset=Dataset%20Beta&thumb=true',
  },
];

describe('DatasetCollection', () => {
  beforeEach(() => {
    mediaListeners.clear();
    mockMatchMedia(true); // Desktop default (>= 768px)
  });

  describe('Desktop view (>= 768px)', () => {
    it('renders a table with dataset name, image/caption count columns, and actions', () => {
      mockMatchMedia(true);
      render(DatasetCollection, { props: { datasets: mockDatasets } });

      const table = screen.getByRole('table');
      expect(table).toBeInTheDocument();

      expect(screen.getByText('Dataset Alpha')).toBeInTheDocument();
      expect(screen.getByText('Dataset Beta')).toBeInTheDocument();
      expect(screen.getByText('12 images • 12 captions')).toBeInTheDocument();
      expect(screen.getByText('5 images • 5 captions')).toBeInTheDocument();

      const deleteButtons = screen.getAllByRole('button', { name: /delete dataset/i });
      expect(deleteButtons.length).toBe(2);
    });

    it('triggers promptDelete with dataset identity when Delete is clicked on desktop', async () => {
      mockMatchMedia(true);
      const onDelete = vi.fn();
      render(DatasetCollection, { props: { datasets: mockDatasets, onDelete } });

      const deleteButtons = screen.getAllByRole('button', { name: /delete dataset/i });
      await fireEvent.click(deleteButtons[0]);

      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete dataset "Dataset Alpha"\?/i)).toBeInTheDocument();
    });

    it('navigates to dataset details link on row/link click', () => {
      mockMatchMedia(true);
      render(DatasetCollection, { props: { datasets: mockDatasets } });

      const links = screen.getAllByRole('link');
      const alphaLink = links.find((l) => l.getAttribute('href') === '/datasets/Dataset%20Alpha');
      expect(alphaLink).toBeDefined();
    });

    it('renders Add Dataset button in desktop view', () => {
      mockMatchMedia(true);
      const onAdd = vi.fn();
      render(DatasetCollection, { props: { datasets: mockDatasets, onAdd } });

      const addBtn = screen.getByRole('button', { name: /add dataset/i });
      expect(addBtn).toBeInTheDocument();
    });
  });

  describe('Phone view (< 768px)', () => {
    it('renders card list and no table on mobile', () => {
      mockMatchMedia(false);
      render(DatasetCollection, { props: { datasets: mockDatasets } });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.getByText('Dataset Alpha')).toBeInTheDocument();
      expect(screen.getByText('Dataset Beta')).toBeInTheDocument();
    });

    it('ensures Delete action is visible on phone and has at least a 44px hit target', () => {
      mockMatchMedia(false);
      render(DatasetCollection, { props: { datasets: mockDatasets } });

      const deleteButtons = screen.getAllByRole('button', { name: /delete dataset/i });
      expect(deleteButtons.length).toBe(2);

      const firstBtn = deleteButtons[0];
      expect(firstBtn).toBeVisible();
      // jsdom does no layout, so size is asserted in e2e/touch-targets.spec.ts.
      // Here we only assert the marker class is gone and no override remains.
      expect(firstBtn.className).not.toContain('touch-target-44');
    });

    it('triggers promptDelete with dataset identity when Delete is clicked on phone', async () => {
      mockMatchMedia(false);
      const onDelete = vi.fn();
      render(DatasetCollection, { props: { datasets: mockDatasets, onDelete } });

      const deleteButtons = screen.getAllByRole('button', { name: /delete dataset/i });
      await fireEvent.click(deleteButtons[0]);

      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete dataset "Dataset Alpha"\?/i)).toBeInTheDocument();
    });

    it('renders cards on the first paint at phone width, with no desktop-table flash', () => {
      mockIsMobile.current = true;
      render(DatasetCollection, { props: { datasets: mockDatasets } });

      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });
});
