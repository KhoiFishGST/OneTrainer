import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import { readable } from 'svelte/store';
import { QueryClient } from '@tanstack/svelte-query';
import LayoutContentTestWrapper from './LayoutContentTestWrapper.svelte';
import { EventClient } from '$lib/events/client';
import { toast } from 'svelte-sonner';

vi.mock('$app/stores', () => ({
  page: readable({ url: new URL('http://localhost/login') }),
}));

vi.mock('svelte-sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: vi.fn(),
}));

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      getHealth: vi.fn().mockResolvedValue({ status: 'ok' }),
      getMeta: vi.fn().mockResolvedValue({ version: '1.0' }),
      getConfig: vi.fn().mockResolvedValue({ config: {}, revision: '1' }),
      getSchema: vi.fn().mockResolvedValue({}),
      getBacklog: vi.fn().mockResolvedValue({ events: [] }),
    },
  };
});

describe('LayoutContent', () => {
  function renderLayoutContent() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.spyOn(queryClient, 'invalidateQueries');

    let activeEventClient: EventClient | null = null;
    vi.spyOn(EventClient.prototype, 'start').mockImplementation(function (this: EventClient) {
      activeEventClient = this;
    });

    render(LayoutContentTestWrapper, { queryClient });

    return { eventClient: activeEventClient!, queryClient };
  }

  it('invalidates persisted gallery queries and triggers a Sonner warning toast', async () => {
    const { eventClient, queryClient } = renderLayoutContent();
    eventClient.emit({ type: 'training_sample', run_key: 'run_a', batch_id: 1 });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gallery', 'current'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gallery', 'runs'] });
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['gallery', 'runs', 'run_a'] });

    eventClient.emit({ type: 'gallery_warning', message: 'thumbnail failed', run_key: 'run_a' });
    expect(toast.warning).toHaveBeenCalledWith('thumbnail failed');
  });

  it('always renders the application shell, because login lives outside this layout', () => {
    renderLayoutContent();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
