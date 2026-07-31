import { render, screen, fireEvent } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';
import DatasetFileCard from './DatasetFileCard.svelte';

test('a video item renders a poster and a play badge', () => {
  render(DatasetFileCard, {
    props: {
      item: { id: 'clip', kind: 'video', media_name: 'clip.mp4', caption_content: '' },
      datasetName: 'ds',
    },
  });

  const poster = screen.getByAltText('clip') as HTMLImageElement;
  expect(poster.src).toContain('/api/datasets/image');
  expect(poster.src).toContain('filename=clip.mp4');
  expect(poster.src).toContain('thumb=true');
  expect(screen.getByLabelText(/play/i)).toBeTruthy();
});

test('clicking a video reports the streaming url and kind', async () => {
  const onMediaClick = vi.fn();
  render(DatasetFileCard, {
    props: {
      item: { id: 'clip', kind: 'video', media_name: 'clip.mp4', caption_content: '' },
      datasetName: 'ds',
      onMediaClick,
    },
  });

  await fireEvent.click(screen.getByAltText('clip'));

  expect(onMediaClick).toHaveBeenCalledWith({
    url: '/api/datasets/video?dataset=ds&filename=clip.mp4',
    kind: 'video',
    filename: 'clip.mp4',
  });
});

test('clicking an image reports the image url', async () => {
  const onMediaClick = vi.fn();
  render(DatasetFileCard, {
    props: {
      item: { id: 'a', kind: 'image', media_name: 'a.png', caption_content: '' },
      datasetName: 'ds',
      onMediaClick,
    },
  });

  await fireEvent.click(screen.getByAltText('a'));

  expect(onMediaClick).toHaveBeenCalledWith({
    url: '/api/datasets/image?dataset=ds&filename=a.png',
    kind: 'image',
    filename: 'a.png',
  });
});

test('a text-only item shows the text placeholder and is not clickable', () => {
  const onMediaClick = vi.fn();
  render(DatasetFileCard, {
    props: {
      item: { id: 'c', kind: 'text', media_name: null, caption_content: 'hi' },
      datasetName: 'ds',
      onMediaClick,
    },
  });

  expect(screen.getByText('Text Only')).toBeTruthy();
});
