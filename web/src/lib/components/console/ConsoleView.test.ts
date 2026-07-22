import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, it, vi } from 'vitest';
import ConsoleView from './ConsoleView.svelte';
import { ConsoleStore } from '$lib/events/console-store.svelte';

const createStore = () => {
  const store = new ConsoleStore();
  store.installBacklog({
    stream_id: 's1',
    cursor: 2,
    revision: 'v1',
    lines: [
      { id: 1, spans: [{ text: 'Hello World', classes: ['fg-green'] }], overwrite: false },
      { id: 2, spans: [{ text: 'Error occurred', classes: ['fg-red', 'bold'] }], overwrite: false },
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
