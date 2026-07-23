import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import ConsoleView from './ConsoleView.svelte';
import { ConsoleStore } from '$lib/events/console-store.svelte';

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
