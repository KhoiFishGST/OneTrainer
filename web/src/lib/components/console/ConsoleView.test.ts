import { render, screen, fireEvent } from '@testing-library/svelte';
import { afterEach, expect, it, vi } from 'vitest';
import { tick } from 'svelte';
import ConsoleView from './ConsoleView.svelte';
import { ConsoleStore } from '$lib/events/console-store.svelte';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalExecCommand = (document as any).execCommand;

/** These are global mutations; leaving them set would bleed into other tests. */
function stubClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    delete (navigator as any).clipboard;
  }
  (document as any).execCommand = originalExecCommand;
});

const createStore = () => {
  const store = new ConsoleStore();
  store.installBacklog({
    stream_id: 's1',
    cursor: 3,
    revision: 'v1',
    lines: [
      { id: 1, spans: [{ text: 'Hello World', classes: ['fg-green'] }], overwrite: false, channel: 'console' },
      { id: 2, spans: [{ text: 'INFO: 127.0.0.1:5000 - GET /api/config HTTP/1.1 200 OK', classes: [] }], overwrite: false, channel: 'webui' },
      { id: 3, spans: [{ text: 'Error occurred', classes: ['fg-red', 'bold'] }], overwrite: false, channel: 'console' },
    ],
    transient: null,
  });
  return store;
};

it('renders console rows and filter controls', async () => {
  const store = createStore();
  render(ConsoleView, { store });

  expect(screen.getByText('Hello World')).toBeInTheDocument();
  expect(screen.getByText('Error occurred')).toBeInTheDocument();

  const filterInput = screen.getByPlaceholderText(/filter/i);
  await fireEvent.input(filterInput, { target: { value: 'Error' } });

  expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
  expect(screen.getByText('Error occurred')).toBeInTheDocument();
});

it('renders connection and download log links', () => {
  const store = createStore();
  store.connectionState = 'connected';
  render(ConsoleView, { store });

  expect(screen.getByText(/connected/i)).toBeInTheDocument();
  const downloadLink = screen.getByRole('link', { name: /download log/i });
  expect(downloadLink).toHaveAttribute('href', '/api/console/log');
});

it('filters logs by channel [Console, Web UI, ALL]', async () => {
  const store = createStore();
  render(ConsoleView, { store });

  // Default is 'Console' channel -> Web UI HTTP logs should be filtered out
  expect(screen.getByText('Hello World')).toBeInTheDocument();
  expect(screen.queryByText(/GET \/api\/config/)).not.toBeInTheDocument();

  // Click 'Web UI' channel button
  const webuiBtn = screen.getByRole('button', { name: 'Web UI' });
  await fireEvent.click(webuiBtn);
  expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
  expect(screen.getByText(/GET \/api\/config/)).toBeInTheDocument();

  // Click 'ALL' channel button
  const allBtn = screen.getByRole('button', { name: 'ALL' });
  await fireEvent.click(allBtn);
  expect(screen.getByText('Hello World')).toBeInTheDocument();
  expect(screen.getByText(/GET \/api\/config/)).toBeInTheDocument();
});

it('supports pause and clear buffer controls', async () => {
  const store = createStore();
  render(ConsoleView, { store });

  const clearBtn = screen.getByRole('button', { name: /clear/i });
  await fireEvent.click(clearBtn);

  expect(screen.queryByText('Hello World')).not.toBeInTheDocument();
});

it('copies every row in view, not just the virtualized window', async () => {
  const store = createStore();
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard({ writeText });

  render(ConsoleView, { store });
  await fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

  expect(writeText).toHaveBeenCalledWith('Hello World\nError occurred');
});

it('copies what the current channel and filter select', async () => {
  const store = createStore();
  const writeText = vi.fn().mockResolvedValue(undefined);
  stubClipboard({ writeText });

  render(ConsoleView, { store });
  await fireEvent.click(screen.getByRole('button', { name: 'ALL' }));
  await fireEvent.input(screen.getByPlaceholderText(/filter/i), {
    target: { value: 'GET' },
  });
  await fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

  expect(writeText).toHaveBeenCalledWith(
    'INFO: 127.0.0.1:5000 - GET /api/config HTTP/1.1 200 OK'
  );
});

it('confirms the copy on the button', async () => {
  const store = createStore();
  stubClipboard({ writeText: vi.fn().mockResolvedValue(undefined) });

  render(ConsoleView, { store });
  const button = screen.getByRole('button', { name: /copy to clipboard/i });
  await fireEvent.click(button);

  expect(await screen.findByText('Copied')).toBeInTheDocument();
});

it('falls back to execCommand when the clipboard API is unavailable', async () => {
  // Served over plain http on a LAN address, navigator.clipboard is undefined.
  const store = createStore();
  stubClipboard(undefined);
  const execCommand = vi.fn().mockReturnValue(true);
  (document as any).execCommand = execCommand;

  render(ConsoleView, { store });
  await fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

  expect(execCommand).toHaveBeenCalledWith('copy');
  expect(await screen.findByText('Copied')).toBeInTheDocument();
});

it('reports a failed copy instead of claiming success', async () => {
  const store = createStore();
  stubClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
  (document as any).execCommand = vi.fn().mockReturnValue(false);

  render(ConsoleView, { store });
  await fireEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));

  expect(await screen.findByText('Copy failed')).toBeInTheDocument();
});

it('disables the copy button when there is nothing to copy', async () => {
  const store = new ConsoleStore();
  render(ConsoleView, { store });

  expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeDisabled();
});

it('fills the viewport with rows once the drawer that mounted it closed expands', async () => {
  // LayoutContent preloads the console drawer on every route, so this
  // component mounts inside a collapsed (height: 0) drawer. A mount-time
  // clientHeight read therefore measures 0 and virtualisation collapses to a
  // handful of rows that never recover, because nothing else recomputes the
  // height. Reproduce that exact sequence: mount closed, then give the
  // element a real size and let the ResizeObserver report it.
  const store = new ConsoleStore();
  store.installBacklog({
    stream_id: 's1',
    cursor: 100,
    revision: 'v1',
    lines: Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      spans: [{ text: `line ${i + 1}`, classes: [] }],
      overwrite: false,
      channel: 'console' as const,
    })),
    transient: null,
  });

  // jsdom reports clientHeight: 0 for every element, so the expanded size has
  // to be faked. Only the scrolling viewport is given one.
  let viewportHeight = 0;
  const originalClientHeight = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'clientHeight'
  );
  Object.defineProperty(Element.prototype, 'clientHeight', {
    get(this: Element) {
      return this.classList.contains('terminal-viewport') ? viewportHeight : 0;
    },
    configurable: true,
  });

  const observers: Array<() => void> = [];
  const originalResizeObserver = window.ResizeObserver;
  window.ResizeObserver = class {
    constructor(private callback: () => void) {}
    observe() {
      observers.push(() => this.callback());
    }
    unobserve() {}
    disconnect() {}
  } as any;
  (globalThis as any).ResizeObserver = window.ResizeObserver;

  try {
    const { rerender } = render(ConsoleView, { store, open: false });

    viewportHeight = 400;
    await rerender({ store, open: true });
    for (const fire of observers) fire();
    await tick();

    // 400px of viewport at 20px per row is 20 rows, plus the 5-row buffer.
    expect(document.querySelectorAll('.console-row').length).toBe(25);
  } finally {
    window.ResizeObserver = originalResizeObserver;
    (globalThis as any).ResizeObserver = originalResizeObserver;
    if (originalClientHeight) {
      Object.defineProperty(Element.prototype, 'clientHeight', originalClientHeight);
    } else {
      delete (Element.prototype as any).clientHeight;
    }
  }
});
